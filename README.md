# paragone-front

Un site statique qui appelle les 23 opérations de l'API de `paragone` : triage des leads, corpus scanné, statistiques du juge, lancement des travaux, référentiel.

Le travail dans ce repo est celui d'une IA sur mes ordres et n'est présent que pour offrir une vue à l'outil `paragone`.

## Prérequis

- `paragone` avec une base `.paragone/findings.db` dans le dossier d'où il se lance.
- Un navigateur récent (modules ES). Aucun outil de build : le dossier `public/` est servi tel quel.
- Pour les tests et le lint seulement : `bun`.

## Installation

Copier le contenu de `public/` dans le dossier public de `paragone` :

```bash
cp -r paragone-front/public/. paragone/srcs/api/public/
```

Ou ne rien copier et le désigner au lancement :

```bash
paragone --serve --public paragone-front/public
```

## Usage

Depuis le dossier qui contient `.paragone/` :

```bash
paragone --serve
```

Ouvrir `http://127.0.0.1:7331/`. Six pages, accessibles par la barre du haut :

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
bunx eslint public tests
bunx prettier --check public/src public/index.html public/style.css tests
```

Pour vérifier en plus que chaque opération du contrat a son appelant, donner une API vivante :

```bash
PARAGONE_API=http://127.0.0.1:7331 bun test
```

## Debug

- **Où va la sortie.** Tout est dans la console du navigateur (`F12`). Une erreur d'API s'affiche aussi dans la page, sous la forme `MÉTHODE url → statut : message`.
- **« API injoignable ».** La page appelle `/api` en chemin relatif : ouverte en `file://` ou servie par un autre serveur, elle ne trouve pas l'API. Utiliser `?api=` et `--cors` (voir plus haut).
- **« illisible » dans le bloc Code.** `/api/source` lit le fichier au chemin enregistré en base, sur la machine qui sert l'API. Un fichier déplacé, supprimé ou scanné ailleurs donne une 404 ; le reste du dossier s'affiche.
- **Lignes du code décalées.** Les positions viennent de la base, pas du fichier actuel : un fichier modifié depuis le scan montre la mauvaise ligne. Relancer `paragone -a <dossier> -s`.
- **Rien ne s'affiche après une copie.** Vérifier que `index.html`, `style.css`, `src/` et `vendor/` sont ensemble dans le même dossier.
- **`Lancer le juge`** dépense des tokens et demande `JEV_API_KEY` côté `paragone` : sans elle, l'API répond 400 et la page l'affiche.
