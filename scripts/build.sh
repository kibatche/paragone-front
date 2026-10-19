#!/usr/bin/env bash

bun install
bun run build:standalone   # -> public/dist/app.js
bun run build:paragone    # -> hermes-plugin/desktop/plugin.js