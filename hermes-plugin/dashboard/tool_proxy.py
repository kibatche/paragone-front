"""Generic lifecycle + reverse-proxy for a local tool server, meant to be dropped
into a Hermes desktop plugin's ``plugin_api.py`` (the backend half mounted at
``/api/plugins/<plugin-id>/``).

One ``ManagedTool`` instance = one local server (paragone, or any future tool
that exposes an HTTP API on localhost). The React/desktop side never talks to
that server directly: it calls ``ctx.rest`` on the plugin's own namespace,
which this router forwards server-to-server via httpx. No browser CORS, no
null/opaque origin, no change needed to the wrapped tool's API or security
posture.

Reuse recipe for a new tool: write zero new proxy code, just instantiate a
new ``ManagedTool(ToolConfig(...))`` with that tool's launch command/port and
mount its ``.router``.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import shlex
import signal
import subprocess
import time
from dataclasses import dataclass
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

log = logging.getLogger(__name__)


@dataclass
class ToolConfig:
    """Everything that differs from one wrapped tool to the next."""

    id: str
    command: list[str]
    cwd: Optional[str] = None
    host: str = "127.0.0.1"
    port: int = 7331
    health_path: str = "/"
    start_timeout_s: float = 10.0
    health_interval_s: float = 0.2
    stop_timeout_s: float = 5.0
    env: Optional[dict] = None


class ManagedTool:
    """Lifecycle + reverse proxy for one local tool server.

    >>> paragone = ManagedTool(ToolConfig(
    ...     id="paragone",
    ...     command=["paragone", "--serve", "--public", "/path/to/paragone-front/public"],
    ...     cwd="/path/to/target-project",
    ...     port=7331,
    ... ))
    >>> router = paragone.router  # top-level `router` your plugin_api.py exports
    """

    def __init__(self, config: ToolConfig):
        self.config = config
        self._proc: Optional[subprocess.Popen] = None
        self._client = httpx.AsyncClient(
            base_url=f"http://{config.host}:{config.port}", timeout=30.0
        )
        self.router = APIRouter()
        self._wire_routes()

    @property
    def base_url(self) -> str:
        return f"http://{self.config.host}:{self.config.port}"

    # ---- lifecycle -----------------------------------------------------

    def is_running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    async def _is_healthy(self) -> bool:
        try:
            resp = await self._client.get(self.config.health_path)
            return resp.status_code < 500
        except httpx.HTTPError:
            return False

    async def ensure_running(self) -> None:
        """Idempotent: start the tool's server if it isn't already answering."""
        if self.is_running() or await self._is_healthy():
            return
        log.info(
            "starting managed tool %s: %s", self.config.id, shlex.join(self.config.command)
        )
        self._proc = subprocess.Popen(
            self.config.command,
            cwd=self.config.cwd,
            env=self.config.env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        deadline = time.monotonic() + self.config.start_timeout_s
        while time.monotonic() < deadline:
            if await self._is_healthy():
                return
            if self._proc.poll() is not None:
                raise RuntimeError(
                    f"{self.config.id} exited during startup (code {self._proc.returncode})"
                )
            await asyncio.sleep(self.config.health_interval_s)
        raise TimeoutError(
            f"{self.config.id} did not become healthy within {self.config.start_timeout_s}s"
        )

    async def stop(self) -> None:
        if self.is_running():
            proc = self._proc
            proc.terminate()
            loop = asyncio.get_event_loop()
            try:
                await loop.run_in_executor(None, lambda: proc.wait(self.config.stop_timeout_s))
            except subprocess.TimeoutExpired:
                proc.kill()
            self._proc = None
            return

        # Nothing we hold a handle to -- but something may still be listening on
        # our port (a plugin/backend reload drops `self._proc` while the real OS
        # process survives, or the user started it by hand before we ever did).
        # `ensure_running()` skips spawning when the port already answers, so a
        # later _stop would otherwise be a silent no-op. Adopt whoever owns the
        # port and terminate it directly instead of only trusting our own handle.
        if not await self._is_healthy():
            return
        pid = self._pid_listening_on_port()
        if pid is None:
            log.warning(
                "%s: port %d is healthy but no owning pid was found; cannot stop it",
                self.config.id,
                self.config.port,
            )
            return
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            return
        deadline = time.monotonic() + self.config.stop_timeout_s
        while time.monotonic() < deadline:
            if not await self._is_healthy():
                return
            await asyncio.sleep(self.config.health_interval_s)
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass

    def _pid_listening_on_port(self) -> Optional[int]:
        """Find the pid bound to our configured port via `ss` (Linux-only)."""
        try:
            out = subprocess.run(
                ["ss", "-ltnp"], capture_output=True, text=True, timeout=3
            ).stdout
        except (OSError, subprocess.SubprocessError):
            return None
        needle = f":{self.config.port} "
        for line in out.splitlines():
            if needle not in line:
                continue
            m = re.search(r"pid=(\d+)", line)
            if m:
                return int(m.group(1))
        return None

    async def status(self) -> dict:
        return {
            "id": self.config.id,
            "running": self.is_running(),
            "healthy": await self._is_healthy(),
            "base_url": self.base_url,
            "cwd": self.config.cwd,
        }

    async def set_cwd(self, path: str, create: bool = False) -> None:
        """Switch the working directory the wrapped tool launches in (its
        "project") and restart it there. The tool's own cwd is where it reads
        its data from at startup (e.g. paragone's ``findings.db``); nothing in
        its own config-replace API can change that without a fresh process --
        confirmed by reading paragone's ``config.ts`` (``setConfig`` only
        replaces ``analyze``/``classes``/``batch``, never the project root),
        not assumed. ``create=True`` makes the directory first (for opening a
        brand-new project); otherwise a missing directory is a 404, never
        silently created.
        """
        if not os.path.isabs(path):
            raise HTTPException(400, "cwd must be an absolute path")
        if create:
            os.makedirs(path, exist_ok=True)
        elif not os.path.isdir(path):
            raise HTTPException(404, f"directory not found: {path}")
        await self.stop()
        self.config.cwd = path
        await self.ensure_running()

    # ---- reverse proxy ---------------------------------------------------

    _HOP_BY_HOP = {"host", "content-length", "content-encoding", "transfer-encoding", "connection"}

    def _wire_routes(self) -> None:
        @self.router.get("/_status")
        async def _status():
            return await self.status()

        @self.router.post("/_start")
        async def _start():
            await self.ensure_running()
            return await self.status()

        @self.router.post("/_stop")
        async def _stop():
            await self.stop()
            return await self.status()

        @self.router.post("/_cwd")
        async def _set_cwd(body: dict):
            path = body.get("path")
            if not isinstance(path, str) or not path:
                raise HTTPException(400, "body.path is required")
            await self.set_cwd(path, create=bool(body.get("create", False)))
            return await self.status()

        @self.router.get("/_fs/list")
        async def _fs_list(path: Optional[str] = None):
            """Browse local directories (and, optionally, files) so the
            desktop UI can navigate to a project or to an analyze target
            without an Electron-native folder dialog (none is exposed to
            plugins) and without anything host-specific -- plain fetch +
            JSON, so the same widget would work unmodified from a browser.
            ``isDir`` lets the front filter files out when only a directory
            makes sense (picking a project). ``hasProject`` flags a directory
            already holding ``.paragone/findings.db`` (open-able) vs one that
            doesn't yet (create-able); always False for files.
            """
            base = os.path.abspath(path or self.config.cwd or os.path.expanduser("~"))
            if not os.path.isdir(base):
                raise HTTPException(404, f"not a directory: {base}")
            try:
                names = sorted(os.listdir(base))
            except PermissionError:
                raise HTTPException(403, f"permission denied: {base}")
            entries = []
            for name in names:
                if name.startswith("."):
                    continue
                full = os.path.join(base, name)
                is_dir = os.path.isdir(full)
                entries.append(
                    {
                        "name": name,
                        "path": full,
                        "isDir": is_dir,
                        "hasProject": is_dir and os.path.isfile(os.path.join(full, ".paragone", "findings.db")),
                    }
                )
            entries.sort(key=lambda e: (not e["isDir"], e["name"].lower()))
            parent = os.path.dirname(base)
            return {
                "path": base,
                "parent": parent if parent != base else None,
                "hasProject": os.path.isfile(os.path.join(base, ".paragone", "findings.db")),
                "entries": entries,
            }

        @self.router.api_route(
            "/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"]
        )
        async def _proxy(path: str, request: Request):
            await self.ensure_running()
            body = await request.body()
            upstream = await self._client.request(
                request.method,
                "/" + path,
                params=request.query_params,
                content=body,
                headers={
                    k: v for k, v in request.headers.items() if k.lower() not in self._HOP_BY_HOP
                },
            )
            return Response(
                content=upstream.content,
                status_code=upstream.status_code,
                headers={
                    k: v
                    for k, v in upstream.headers.items()
                    if k.lower() not in self._HOP_BY_HOP
                },
                media_type=upstream.headers.get("content-type"),
            )
