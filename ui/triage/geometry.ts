/**
 * triage/geometry.ts — Port fidèle de `public/src/triage/code_geometry.js` :
 * calculs de la vue code virtualisée, sans DOM. Fonctions pures.
 */
export const LINE_HEIGHT_PX = 22;
export const CODE_GUTTER_PX = 80;
const TAB_SIZE = 8;
const CODE_BUFFER = 12;

/** Lignes à rendre (index 0-based, fin exclue), avec `CODE_BUFFER` lignes de marge de part et d'autre. */
export function visibleRange(scrollTop: number, clientHeight: number, total: number): { first: number; last: number } {
  const visible = Math.ceil(clientHeight / LINE_HEIGHT_PX) || 40;
  const first = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT_PX) - CODE_BUFFER);
  const last = Math.min(total, first + visible + 2 * CODE_BUFFER);
  return { first, last };
}

/** Défilement qui centre la ligne `line` (numérotée à partir de 1). */
export function scrollTopFor(line: number, clientHeight: number): number {
  return Math.max(0, (line - 1) * LINE_HEIGHT_PX - clientHeight / 2);
}

/** Ligne (numérotée à partir de 1) au milieu de la fenêtre. */
export function centerLine(scrollTop: number, clientHeight: number): number {
  return Math.floor((scrollTop + clientHeight / 2) / LINE_HEIGHT_PX + 1);
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!);
}

/** Colonne affichée d'un index de caractère : une tabulation avance au taquet suivant. */
export function visualColumn(text: string, index: number): number {
  let column = 0;
  for (let i = 0; i < index && i < text.length; i++) {
    column = text[i] === "\t" ? column + TAB_SIZE - (column % TAB_SIZE) : column + 1;
  }
  return column;
}

export type Span = [number, number, number, number];

/**
 * Portion de la ligne `lineNumber` couverte par une plage, en colonnes affichées.
 * Une ligne intérieure à la plage est couverte de son premier caractère non blanc à sa fin.
 */
export function highlightRange(
  text: string,
  span: Span | null | undefined,
  lineNumber: number,
): { from: number; to: number } | null {
  if (!span) return null;
  const [startLine, startColumn, endLine, endColumn] = span;
  if (lineNumber < startLine || lineNumber > endLine) return null;
  const from = lineNumber === startLine ? startColumn : text.search(/\S|$/);
  const to = lineNumber === endLine ? endColumn : text.length;
  if (to <= from) return null;
  return { from: visualColumn(text, from), to: visualColumn(text, to) };
}
