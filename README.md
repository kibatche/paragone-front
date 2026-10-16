# paragone-front

Front de `paragone` (triage statique de vulns client-side) : file de triage,
inventaires, corpus scanné, statistiques du juge, lancement des travaux,
référentiel. Appelle les opérations de l'API `paragone` (`--serve`, contrat
sur `/openapi`).

Le travail dans ce repo est celui d'une IA sur mes ordres.

Deux fronts partagent le même code, à deux endroits différents :

- **`public/`** -- l'original, vanilla JS, servi tel quel par `paragone
--serve --public`. Aucun outil de build requis pour l'utiliser.
- **`ui/`** -- le port React des mêmes vues (`ui/views/*`, `ui/triage/*`,
  `ui/components/*`, `ui/api/client.ts`), compilé vers **deux cibles** qui ne
  partagent qu'une différence : qui leur fournit les données (un `Fetcher`
  injecté -- `fetch` du navigateur d'un côté, le proxy `ctx.rest` de Hermes de
  l'autre). Voir la section suivante.

## Les deux fronts React : web autonome et plugin Hermes

```
ui/
├── api/, components/, triage/, views/, format.ts   <- partagé, Fetcher-agnostique
├── standalone/   -> build:standalone -> public/dist/app.js  (servi par paragone --serve)
└── hermes/       -> build:paragone  -> hermes-plugin/desktop/plugin.js (plugin desktop Hermes)
```

- **Front web autonome** (`ui/standalone/`) : un point d'entrée qui possède
  toute la fenêtre du navigateur, fait ses propres `fetch` vers `/api/...`,
  et gère son propre routage par URL (`#/triage?...`). Chargé par `public/index.html`.
- **Plugin desktop Hermes** (`ui/hermes/`) : un onglet dans l'app desktop
  [Hermes](https://hermes-agent.nousresearch.com/docs).

Les deux cibles compilent le même `ui/views/*` : une vue qui marche dans
l'une marche dans l'autre sans rien y changer.

### Build

```bash
bun install
bun run build:standalone   # -> public/dist/app.js
bun run build:paragone    # -> hermes-plugin/desktop/plugin.js
```

`build:paragone` externalise `react`, `react/jsx-runtime` et
`@hermes/plugin-sdk` (déjà fournis par l'hôte desktop) -- tout le reste
(Shiki pour la coloration syntaxique, etc.) est bundlé dans le fichier,
seul fichier ESM que l'hôte charge.

## Front web autonome -- installation

Copier le contenu de `public/` dans le dossier public de `paragone` :

```bash
cp -r paragone-front/public/. paragone/srcs/api/public/
```

Ou ne rien copier et le désigner au lancement :

```bash
paragone --serve --public paragone-front/public
```

Depuis le dossier qui contient `.paragone/` :

```bash
paragone --serve
```

Ouvrir `http://127.0.0.1:7331/`. Six pages,
accessibles par la barre du haut :

- **Triage** : la file des leads, le dossier du lead ouvert (verdict du juge, sink, origines du taint, doublons, cadre de jugement, code source). Les gestes se font au clavier : `j`/`k` lead suivant ou précédent, `a` retenir, `r` rejeter, `e` escalader, `n` commentaire, `u` annuler le dernier tri, `/` rechercher. Dans le dossier, la fenêtre de code parcourt le fichier entier : ◀ ▶ passent du sink aux origines du taint (la portion de l'étape est surlignée), « agrandir » la met en plein écran, `Échap` la referme.
- **Inventaires** : les leads d'inventaire (chemins, hôtes, secrets, stockage, cookies), jamais jugés, dans la même vue que le triage. Décisions : `a` à creuser, `i` noter, `r` bruit, plus « dormant ». Pas d'escalade.
- **Corpus** : fichiers scannés, puis matches des analyzers. Un clic sur un fichier ouvre ses matches.
- **Statistiques** : répartitions de la base et coût du juge. Un clic sur une barre ouvre le triage filtré.
- **Travaux** : configuration en mémoire, lancement du scan et du juge, suivi du travail en cours.
- **Référentiel** : projet servi, vocabulaire et légendes, analyzers jugés.

Une route accepte des filtres : `#/triage?class=XSS&score=HIGH`, `#/corpus?tab=matches&file_id=1`.

### Front hébergé ailleurs que l'API

Ouvrir la page avec `?api=http://127.0.0.1:7331` (la valeur est mémorisée par le navigateur ; `?api=` vide l'oublie) et lancer `paragone` avec l'origine de la page :

```bash
paragone --serve --cors http://localhost:5173
```

## Plugin desktop Hermes -- installation

Le code du plugin (backend Python compris) vit entièrement dans ce repo,
sous `hermes-plugin/` -- pas un second repo, pas de copie manuelle de
fichiers Python ailleurs. Un script l'installe en une commande :

```bash
cd paragone-front
./scripts/install-hermes-plugin.sh
```

Ce que ça fait (et pourquoi c'est sûr de le relancer) :

1. `bun install`.
2. Crée un **lien symbolique** `~/.hermes/plugins/paragone ->
<ce repo>/hermes-plugin` (jamais une copie) -- c'est le workflow que la
   doc Hermes documente elle-même pour un paquet qu'on développe : l'app
   re-synchronise sa copie interne à chaque sauvegarde de `desktop/plugin.js`
   tant que le lien existe. Si le lien pointe déjà ici, rien à refaire ; s'il
   pointe ailleurs ou si un vrai dossier existe déjà à cet endroit, le script
   s'arrête et dit quoi faire à la main plutôt que d'écraser quelque chose.
3. `bun run build:paragone`, qui écrit directement dans
   `hermes-plugin/desktop/plugin.js` -- donc, via le lien, directement dans
   l'install Hermes.

Deux réglages restent à faire une fois dans l'app Hermes (le script les
rappelle à l'écran) :

1. Lister `paragone` dans `plugins.enabled:` de `~/.hermes/config.yaml` --
   un plugin Python n'est importé que s'il y est explicitement autorisé
   (frontière de sécurité, pas un oubli).
2. **Capabilities → Plugins** : activer `paragone`, puis **Rescan**.

Après un changement du backend (`hermes-plugin/dashboard/*.py`), **Rescan**
ne suffit pas -- il ne recharge que `desktop/plugin.js` (le process gateway
déjà vivant garde l'ancien module Python en mémoire). Quitter et relancer
tout le desktop.

Dans l'app, paragone liste ses "briques" (paragone aujourd'hui, d'autres
outils locaux pourront s'y ajouter sans toucher au sélecteur) ; la brique
sélectionnée affiche son statut (pastille verte/rouge) et un bouton
Démarrer/Arrêter à droite de ses propres onglets (Projet, Scan & Juge,
Triage, Inventaires, Corpus, Statistiques, Référentiel, Debug). Ouvrir un
projet existant ou en créer un se fait depuis l'onglet **Projet** (un
navigateur de dossiers, pas de chemin texte libre).

Pas de projet choisi au premier lancement (le dossier de démarrage par
défaut, `$HOME`, n'en a pas) -- c'est voulu : ouvrir ou créer le vôtre
depuis cet onglet.

## Captures

### Version Web

### Version Hermes

## Tests

```bash
cd ~/Projects/paragone-front
bun install
bun test
bunx tsc --noEmit -p tsconfig.json
bun run lint
bun run format
```

Pour vérifier en plus que chaque opération du contrat a son appelant, donner une API vivante :

```bash
PARAGONE_API=http://127.0.0.1:7331 bun test
```
