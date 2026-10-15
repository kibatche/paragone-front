/**
 * triage/highlight.ts — Coloration syntaxique via Shiki (même moteur que
 * Hermes utilise pour ses propres blocs de code de chat), bundlée
 * directement dans notre fichier (jamais externalisée -- un plugin desktop
 * Hermes ne peut importer que `@hermes/plugin-sdk`/`react`/
 * `react/jsx-runtime`, voir `references/desktop-plugins.md`). Import
 * "fine-grained" (juste JS + le thème GitHub Dark -- celui que
 * `public/vendor/highlight-theme.css` donnait déjà à highlight.js, parité
 * visuelle garantie) pour garder le bundle raisonnable (~450 Ko) ; moteur
 * JS pur (`createJavaScriptRegexEngine`), pas de WASM à charger en plus.
 * Rend du HTML à styles EN LIGNE (`span style="color:#…"`) : aucune
 * feuille de style hôte requise, contrairement à highlight.js (classes
 * `.hljs-*` + CSS séparé).
 */
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import jsLang from "shiki/langs/javascript.mjs";
import githubDark from "shiki/themes/github-dark.mjs";

let highlighterPromise: Promise<HighlighterCore> | null = null;

function highlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [githubDark],
      langs: [jsLang],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

/** HTML coloré (un seul `<pre><code>`, styles en ligne) pour du JS. */
export async function highlightJs(code: string): Promise<string> {
  const hl = await highlighter();
  return hl.codeToHtml(code, { lang: "javascript", theme: "github-dark" });
}

/** Les lignes déjà coloré (`highlightJs`), redécoupées, chaque `<span>` traversant un saut de ligne rouvert -- port de `code_geometry.js::splitHighlightedLines`. */
export function splitHighlightedLines(html: string): string[] {
  const lines: string[] = [];
  const open: string[] = [];
  for (const raw of html.split("\n")) {
    const line = open.join("") + raw;
    for (const [tag] of raw.matchAll(/<span[^>]*>|<\/span>/g)) {
      if (tag === "</span>") open.pop();
      else open.push(tag);
    }
    lines.push(line + "</span>".repeat(open.length));
  }
  return lines;
}
