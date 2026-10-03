/**
 * @author [A likely boring stuff made by] Shevek
 * @desc code_geometry.js — Calculs de la vue code virtualisée, sans DOM : lignes à rendre pour un
 *       défilement, découpe en lignes du HTML coloré, colonne affichée d'un caractère, portion
 *       d'une ligne couverte par une plage.
 */

import { CODE_BUFFER, LINE_HEIGHT_PX, TAB_SIZE } from "./constants.js";

/** Lignes à rendre (index 0-based, fin exclue), avec `CODE_BUFFER` lignes de marge de part et d'autre. */
export function visibleRange(scrollTop, clientHeight, total) {
  const visible = Math.ceil(clientHeight / LINE_HEIGHT_PX) || 40;
  const first = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT_PX) - CODE_BUFFER);
  const last = Math.min(total, first + visible + 2 * CODE_BUFFER);
  return { first, last };
}

/** Défilement qui centre la ligne `line` (numérotée à partir de 1). */
export function scrollTopFor(line, clientHeight) {
  return Math.max(0, (line - 1) * LINE_HEIGHT_PX - clientHeight / 2);
}

/** Ligne (numérotée à partir de 1) au milieu de la fenêtre. */
export function centerLine(scrollTop, clientHeight) {
  return Math.floor((scrollTop + clientHeight / 2) / LINE_HEIGHT_PX + 1);
}

/** Redécoupe le HTML de highlight.js en lignes, en rouvrant les `<span>` qui traversent un saut de ligne. */
export function splitHighlightedLines(html) {
  const lines = [];
  const open = [];
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

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

export function escapeHtml(text) {
  return text.replace(/[&<>]/g, (char) => HTML_ESCAPES[char]);
}

/** Colonne affichée d'un index de caractère : une tabulation avance au taquet suivant. */
export function visualColumn(text, index) {
  let column = 0;
  for (let i = 0; i < index && i < text.length; i++) {
    column = text[i] === "\t" ? column + TAB_SIZE - (column % TAB_SIZE) : column + 1;
  }
  return column;
}

/**
 * Portion de la ligne `lineNumber` couverte par une plage, en colonnes affichées.
 * Une ligne intérieure à la plage est couverte de son premier caractère non blanc à sa fin.
 * @param span `[ligne, colonne, ligne de fin, colonne de fin]`, ou null
 * @return `{ from, to }`, ou null si la ligne est hors plage ou la portion vide
 */
export function highlightRange(text, span, lineNumber) {
  if (!span) return null;
  const [startLine, startColumn, endLine, endColumn] = span;
  if (lineNumber < startLine || lineNumber > endLine) return null;
  const from = lineNumber === startLine ? startColumn : text.search(/\S|$/);
  const to = lineNumber === endLine ? endColumn : text.length;
  if (to <= from) return null;
  return { from: visualColumn(text, from), to: visualColumn(text, to) };
}
