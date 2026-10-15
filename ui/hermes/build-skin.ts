/**
 * build-skin.ts — Génère `hermes/skin.generated.ts` : le CSS de
 * `public/style.css` (jetons de couleur, cartes, tableaux, etc.), mais
 * récrit pour vivre DANS le desktop Hermes sans polluer le reste de
 * l'app :
 *   - `body { ... }` devient `.paragone-skin { ... }` -- les styles de
 *     mise en page de la coquille paragone s'appliquent à notre propre
 *     conteneur, pas au <body> réel de Hermes.
 *   - `html,\nbody { height:100%; margin:0 }` est supprimé -- sans objet
 *     hors d'une page autonome.
 *   - tout le reste est enveloppé dans `@scope (.paragone-skin)` : les
 *     sélecteurs ne matchent plus qu'à l'intérieur de notre conteneur,
 *     `:root { --bg: ...; }` reste en dehors (les custom properties
 *     traversent les frontières de @scope, c'est voulu : elles doivent
 *     être visibles par nos propres règles scopées).
 *
 * Lancé par `build:panoptika` avant `bun build` -- voir package.json.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = new URL("../../public/style.css", import.meta.url);
const OUT = new URL("./skin.generated.ts", import.meta.url);

const css = readFileSync(SOURCE, "utf8");

const rootMatch = css.match(/:root\s*\{[^}]*\}/s);
if (!rootMatch) throw new Error("build-skin: aucun bloc :root trouvé dans public/style.css");
const root = rootMatch[0];

const rest = css
  .slice(rootMatch.index! + rootMatch[0].length)
  // `html,\nbody { height: 100%; margin: 0; }` -- sans objet ici, on le retire.
  .replace(/html,\s*\nbody\s*\{[^}]*\}/s, "")
  // `body { ... }` porte la mise en page de la coquille paragone -- notre conteneur.
  .replace(/(^|\n)body\s*\{/, "$1.paragone-skin {");

const scoped = `${root}\n\n@scope (.paragone-skin) {\n${rest}\n}\n`;

writeFileSync(
  OUT,
  `// Généré par ui/hermes/build-skin.ts depuis public/style.css -- NE PAS ÉDITER À LA MAIN.\nexport const skinCss = ${JSON.stringify(scoped)};\n`,
);

console.log(`build-skin: ${OUT.pathname} écrit (${scoped.length} caractères, depuis ${SOURCE.pathname})`);
