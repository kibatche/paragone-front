"""paragone -- agent-side half.

This plugin has no agent tools/hooks of its own: everything it does lives in
dashboard/plugin_api.py (the HTTP proxy to the local `paragone --serve`
process) and desktop/plugin.js (the UI, built from ui/hermes/plugin.tsx --
see scripts/install-hermes-plugin.sh). register(ctx) is still required so
Hermes can import the plugin package at all.
"""


def register(ctx):
    return None
