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
└── hermes/       -> build:panoptika  -> hermes-plugin/desktop/plugin.js (plugin desktop Hermes)
```

- **Front web autonome** (`ui/standalone/`) : un point d'entrée qui possède
  toute la fenêtre du navigateur, fait ses propres `fetch` vers `/api/...`,
  et gère son propre routage par URL (`#/triage?...`, back/forward
  fonctionnent). Chargé par `public/react.html`.
- **Plugin desktop Hermes** (`ui/hermes/`) : un onglet dans l'app desktop
  [Hermes](https://hermes-agent.nousresearch.com/docs), qui ne fait jamais de
  `fetch` direct -- tout passe par `ctx.rest` (le proxy server-to-server du
  backend du plugin, qui lance/arrête `paragone` lui-même et relaie son API,
  donc pas de CORS et pas de process `paragone` à gérer à la main). Ce
  fichier porte aussi ce qui n'a de sens que dans Hermes : menu de briques
  (paragone n'est qu'une des briques futures de "panoptika"), cycle de vie
  (Démarrer/Arrêter), explorateur d'API générique.

Les deux cibles compilent le même `ui/views/*` : une vue qui marche dans
l'une marche dans l'autre sans rien y changer, seul le `Fetcher` passé en
prop diffère. C'est la raison d'être de la couche `ui/api/client.ts` --
aucune des vues ne sait qui l'héberge.

### Build

```bash
bun install
bun run build:standalone   # -> public/dist/app.js
bun run build:panoptika    # -> hermes-plugin/desktop/plugin.js
```

`build:panoptika` externalise `react`, `react/jsx-runtime` et
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

Ouvrir `http://127.0.0.1:7331/` (vanilla, `index.html`) ou
`http://127.0.0.1:7331/react.html` (port React, même vues). Six pages,
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
2. Crée un **lien symbolique** `~/.hermes/plugins/panoptika ->
<ce repo>/hermes-plugin` (jamais une copie) -- c'est le workflow que la
   doc Hermes documente elle-même pour un paquet qu'on développe : l'app
   re-synchronise sa copie interne à chaque sauvegarde de `desktop/plugin.js`
   tant que le lien existe. Si le lien pointe déjà ici, rien à refaire ; s'il
   pointe ailleurs ou si un vrai dossier existe déjà à cet endroit, le script
   s'arrête et dit quoi faire à la main plutôt que d'écraser quelque chose.
3. `bun run build:panoptika`, qui écrit directement dans
   `hermes-plugin/desktop/plugin.js` -- donc, via le lien, directement dans
   l'install Hermes.

Deux réglages restent à faire une fois dans l'app Hermes (le script les
rappelle à l'écran) :

1. Lister `panoptika` dans `plugins.enabled:` de `~/.hermes/config.yaml` --
   un plugin Python n'est importé que s'il y est explicitement autorisé
   (frontière de sécurité, pas un oubli).
2. **Capabilities → Plugins** : activer `panoptika`, puis **Rescan**.

Après un changement du backend (`hermes-plugin/dashboard/*.py`), **Rescan**
ne suffit pas -- il ne recharge que `desktop/plugin.js` (le process gateway
déjà vivant garde l'ancien module Python en mémoire). Quitter et relancer
tout le desktop.

Dans l'app, panoptika liste ses "briques" (paragone aujourd'hui, d'autres
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

<img width="2501" height="949" alt="image" src="https://github.com/user-attachments/assets/0a967b9c-233f-41ed-9c6d-79d569cc6049" />

<img width="1368" height="429" alt="image" src="https://github.com/user-attachments/assets/51304c71-64ad-4d9b-9d6a-3bf4f51824b8" />

<img width="1368" height="1281" alt="image" src="https://github.com/user-attachments/assets/7f1c1e4b-ad90-4111-95f4-2ddc40487aeb" />

<img width="1368" height="791" alt="image" src="https://github.com/user-attachments/assets/6acdb07f-5586-48f6-b0eb-e68948590acb" />

<img width="1368" height="1283" alt="image" src="https://github.com/user-attachments/assets/8db5eb98-5f5b-4475-bef4-f43e3252bcfb" />

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

## Debug

- **Où va la sortie (front web).** Tout est dans la console du navigateur (`F12`). Une erreur d'API s'affiche aussi dans la page, sous la forme `MÉTHODE url → statut : message`.
- **Où va la sortie (plugin Hermes).** Les erreurs de Démarrer/Arrêter sortent comme un toast natif Hermes (`host.notifyError`). Un échec de poll de statut (toutes les 4s) reste silencieux -- il se voit déjà via la pastille rouge.
- **« API injoignable ».** La page appelle `/api` en chemin relatif : ouverte en `file://` ou servie par un autre serveur, elle ne trouve pas l'API. Utiliser `?api=` et `--cors` (voir plus haut).
- **« illisible » dans le bloc Code.** `/api/source` lit le fichier au chemin enregistré en base, sur la machine qui sert l'API. Un fichier déplacé, supprimé ou scanné ailleurs donne une 404 ; le reste du dossier s'affiche.
- **Lignes du code décalées.** Les positions viennent de la base, pas du fichier actuel : un fichier modifié depuis le scan montre la mauvaise ligne. Relancer `paragone -a <dossier> -s`.
- **Rien ne s'affiche après une copie.** Vérifier que `index.html`, `style.css`, `src/` et `vendor/` sont ensemble dans le même dossier.
- **`Lancer le juge`** dépense des tokens et demande `JEV_API_KEY` côté `paragone` : sans elle, l'API répond 400 et la page l'affiche.
- **Le plugin Hermes ne voit pas mes derniers changements.** `hermes plugins doctor panoptika` dit si la copie interne de l'app (`~/.hermes/desktop-plugins/panoptika`) est périmée par rapport au lien -- **Rescan** pour `desktop/plugin.js`, relancer tout le desktop pour `dashboard/*.py`.
