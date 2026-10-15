#!/usr/bin/env bash
# Installs the panoptika Hermes desktop plugin from THIS checkout, as a
# "unified package" (plugin.yaml + dashboard/ backend + desktop/ UI) --
# see https://hermes-agent.nousresearch.com/docs -> Desktop Plugin SDK,
# "One package, both SDKs".
#
# Strategy: symlink $HERMES_HOME/plugins/panoptika -> <this repo>/hermes-plugin
# instead of copying files. This is the SDK's own documented workflow for a
# package you are actively developing ("a linked package's copy is marked
# linked: true... every save re-syncs the copy"): every `bun run
# build:panoptika` after this script runs writes straight into the live
# install, no extra copy step, no drift between the repo and what Hermes
# actually loads.
#
# Usage:
#   ./scripts/install-hermes-plugin.sh
#
# Re-run anytime (idempotent): a correct symlink is left alone; the plugin.js
# bundle is always rebuilt. Override the install root with HERMES_HOME if
# your Hermes config lives somewhere other than ~/.hermes.
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_DIR="$(pwd)"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
TARGET="$HERMES_HOME/plugins/panoptika"

echo "== 1/3 : dépendances (bun install) =="
bun install

echo "== 2/3 : installation du paquet unifié =="
mkdir -p "$(dirname "$TARGET")"
if [ -L "$TARGET" ]; then
  current="$(readlink -f "$TARGET")"
  if [ "$current" = "$REPO_DIR/hermes-plugin" ]; then
    echo "déjà en place : $TARGET -> $current"
  else
    echo "erreur : $TARGET est déjà un lien vers $current (pas ce dépôt)." >&2
    echo "supprimer ce lien à la main si vous voulez le remplacer." >&2
    exit 1
  fi
elif [ -e "$TARGET" ]; then
  echo "erreur : $TARGET existe déjà et n'est pas un lien symbolique." >&2
  echo "le déplacer ou le supprimer avant de relancer ce script." >&2
  exit 1
else
  ln -s "$REPO_DIR/hermes-plugin" "$TARGET"
  echo "lien créé : $TARGET -> $REPO_DIR/hermes-plugin"
fi

echo "== 3/3 : build du plugin desktop (bun run build:panoptika) =="
bun run build:panoptika

cat <<EOF

Installé. Il reste deux réglages ponctuels côté Hermes (une fois, pas à
chaque réinstallation) :

1. Autoriser le backend Python (sécurité -- un plugin Python n'est importé
   que s'il est explicitement listé) : dans ${HERMES_HOME}/config.yaml,
   sous la clé "plugins:", ajouter "panoptika" à la liste "enabled:" si ce
   n'est pas déjà fait :

     plugins:
       enabled:
         - panoptika

2. Dans le desktop Hermes : Capabilities -> Plugins -> activer "panoptika"
   (si pas déjà actif) -> Rescan. Après un changement du backend Python
   (dashboard/plugin_api.py, tool_proxy.py) il faut quitter et relancer tout
   le desktop -- Rescan ne recharge que desktop/plugin.js.

Aucun projet paragone n'est présélectionné (le dossier de démarrage par
défaut, \$HOME, n'en contient pas) : ouvrir ou créer le vôtre depuis
l'onglet "Projet" du plugin une fois lancé -- ça persiste sans rien
reconfigurer ici. PARAGONE_PROJECT_DIR n'est lu qu'au démarrage du
*backend Hermes* (pas de ce script) ; ne le définissez que si vous
voulez changer ce dossier de démarrage par défaut dans l'environnement
du processus \`hermes serve\`/desktop lui-même.
EOF
