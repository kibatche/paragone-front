"""Backend half of the paragone Hermes plugin, mounted at /api/plugins/paragone/.

One ManagedTool wrapping the local `paragone --serve` process -- no bricks
registry, no menu: this plugin is paragone and only paragone. Each Hermes
brick/tool lives in its OWN plugin now (option D, 2026-10-15 -- see
WORK/panoptika-architecture-decision in the lifeos-memory corpus): there is
no shared "panoptika" shell to register into anymore.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# tool_proxy.py sits right next to this file; make sure it resolves regardless
# of how Hermes imports this module (plain file load vs package import).
sys.path.insert(0, os.path.dirname(__file__))

from tool_proxy import ManagedTool, ToolConfig

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
