"""Backend half of the paragone Hermes plugin, mounted at /api/plugins/paragone/.

One ManagedTool wrapping the local `paragone --serve` process -- no bricks
registry, no menu: this plugin is paragone and only paragone. Each Hermes
brick/tool lives in its OWN plugin now (option D, 2026-10-15 -- see
WORK/panoptika-architecture-decision in the lifeos-memory corpus): there is
no shared "panoptika" shell to register into anymore.
"""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

# tool_proxy.py sits right next to this file. Loaded by explicit file path
# under a plugin-private module name -- NEVER `sys.path.insert` + bare
# `import tool_proxy`. Hermes mounts every enabled plugin's plugin_api.py in
# ONE process; the `obs` plugin ships its own same-named `dashboard/tool_proxy.py`
# (verbatim copy, see its docstring). A bare `import tool_proxy` is cached in
# `sys.modules["tool_proxy"]` by that bare name regardless of which plugin's
# sys.path put it there first -- whichever plugin mounts first (obs mounts
# before paragone every boot, per gui.log) wins the cache, and the other
# silently gets the WRONG plugin's ManagedTool class. This is exactly what
# broke project recognition here: paragone ended up running obs's older
# `_fs/list` (no `.paragone/findings.db` / `hasProject` field at all) because
# obs loaded first. Loading by file path under a unique name sidesteps the
# shared bare-name cache entirely, independent of mount order.
_tool_proxy_path = Path(__file__).resolve().parent / "tool_proxy.py"
_spec = importlib.util.spec_from_file_location("paragone_dashboard_tool_proxy", _tool_proxy_path)
assert _spec is not None and _spec.loader is not None, f"cannot load spec for {_tool_proxy_path}"
_tool_proxy = importlib.util.module_from_spec(_spec)
# Register BEFORE exec_module: dataclass/pydantic resolve string annotations
# and class.__module__ lookups via sys.modules[module.__name__] while the
# module body is still executing -- an unregistered module crashes @dataclass
# itself (confirmed), not just later introspection.
sys.modules[_spec.name] = _tool_proxy
_spec.loader.exec_module(_tool_proxy)
ManagedTool = _tool_proxy.ManagedTool
ToolConfig = _tool_proxy.ToolConfig

# This file lives at <paragone-front repo>/hermes-plugin/dashboard/plugin_api.py
# (installed into Hermes as a symlinked "unified package" -- see
# scripts/install-hermes-plugin.sh): walking up from here always finds this
# checkout's own public/ build output, whoever installs it and wherever the
# repo sits -- no hardcoded personal path.
_REPO_ROOT = Path(__file__).resolve().parents[2]

PARAGONE_PUBLIC_DIR = os.environ.get(
    "PARAGONE_PUBLIC_DIR", str(_REPO_ROOT / "public")
)
# No sane universal default for "which project to analyze" -- $HOME always
# exists but holds no project, which is deliberate: open (or create) a real
# project from the plugin's "Projet" tab after install, rather than this
# backend guessing at a path that happens to exist on one particular machine.
PARAGONE_PROJECT_DIR = os.environ.get(
    "PARAGONE_PROJECT_DIR", os.path.expanduser("~")
)

paragone = ManagedTool(
    ToolConfig(
        id="paragone",
        command=["paragone", "--serve", "--public", PARAGONE_PUBLIC_DIR],
        cwd=PARAGONE_PROJECT_DIR,
        port=7331,
    )
)

# No prefix, no registry: paragone's own router IS this plugin's router.
router = paragone.router

# Routes end up at:
#   GET  /api/plugins/paragone/_status
#   POST /api/plugins/paragone/_start
#   POST /api/plugins/paragone/_stop
#   *    /api/plugins/paragone/<anything paragone's own API serves>
#        (e.g. /openapi/json for its OpenAPI contract, /meta, ...)
