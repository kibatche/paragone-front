"""Backend half of panoptika, mounted at /api/plugins/panoptika/.

One ManagedTool per local tool. Add the next tool (not just paragone) by
adding another ManagedTool instance and include_router-ing it under its own
prefix -- no new proxy code.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# tool_proxy.py sits right next to this file; make sure it resolves regardless
# of how Hermes imports this module (plain file load vs package import).
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import APIRouter

from tool_proxy import ManagedTool, ToolConfig

# --- paragone -----------------------------------------------------------
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

# --- bricks registry ------------------------------------------------------
# panoptika is the centre; each wrapped tool is a "brique" the desktop side
# lets the user pick from a menu (like Capabilities -> Plugins). Register a
# new tool by adding it to this dict with a human label -- nothing else
# about the selector menu changes. Mounted under its own id as prefix.
BRICKS: dict[str, ManagedTool] = {
    "paragone": paragone,
}
BRICK_LABELS: dict[str, str] = {
    "paragone": "paragone",
}

router = APIRouter()
for brick_id, tool in BRICKS.items():
    router.include_router(tool.router, prefix=f"/{brick_id}")


@router.get("/_bricks")
async def _bricks():
    return [
        {"id": brick_id, "label": BRICK_LABELS.get(brick_id, brick_id), **(await tool.status())}
        for brick_id, tool in BRICKS.items()
    ]


# Routes end up at:
#   GET  /api/plugins/panoptika/_bricks
#   GET  /api/plugins/panoptika/paragone/_status
#   POST /api/plugins/panoptika/paragone/_start
#   POST /api/plugins/panoptika/paragone/_stop
#   *    /api/plugins/panoptika/paragone/<anything paragone's own API serves>
#        (e.g. /paragone/openapi/json for its OpenAPI contract, /paragone/meta, ...)
