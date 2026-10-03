/**
 * @author [A likely boring stuff made by] Shevek
 * @desc code_steps.js — Les étapes que la vue code parcourt pour un lead : le sink, puis les origines du
 *       taint dans l'ordre où le dossier les liste, et les lignes à marquer. Dit aussi si un nœud traverse
 *       une méthode de désinfection. Fonctions pures.
 */

import { SANITIZER_LABEL, SOURCE_KIND } from "./constants.js";

/** Le nœud traverse une méthode de désinfection : `sanitizeMethod` est absent ou vide sinon. */
export function isSanitized(finding) {
  return Boolean(finding.sanitizeMethod);
}

/** Libellé court d'un nœud désinfectant : « désinfection : sanitize ». */
export function sanitizerLabel(finding) {
  return `${SANITIZER_LABEL} : ${finding.sanitizeMethod}`;
}

/**
 * Plage du texte du match à partir de sa position de départ. Le texte peut couvrir plusieurs lignes.
 * @return `[ligne, colonne, ligne de fin, colonne de fin]`
 */
export function matchSpan(line, column, text) {
  const rows = String(text ?? "").split("\n");
  if (rows.length === 1) return [line, column, line, column + rows[0].length];
  return [line, column, line + rows.length - 1, rows.at(-1).length];
}

function originSpan(finding) {
  const { start, end } = finding.loc ?? {};
  if (!start || !end) return null;
  return [start.line, start.column, end.line, end.column];
}

function originLabel(finding) {
  if (finding.kind === SOURCE_KIND && finding.knownSource) return finding.knownSource;
  if (isSanitized(finding)) return sanitizerLabel(finding);
  return (finding.text ?? "").split("\n")[0].trim() || finding.kind;
}

/**
 * @param findings les origines du taint
 * @return `{ origin, sanitized }` : les numéros de ligne des origines, et parmi eux ceux des nœuds désinfectants
 */
export function originLines(findings) {
  const origin = new Set();
  const sanitized = new Set();
  for (const finding of findings) {
    const line = finding.loc?.start?.line;
    if (!line) continue;
    origin.add(line);
    if (isSanitized(finding)) sanitized.add(line);
  }
  return { origin, sanitized };
}

/**
 * @param item le lead tel que rendu par `/api/lead/:id`
 * @return `[{ label, span }]` : le sink en premier ; `span` vaut null pour une origine sans position
 */
export function codeSteps(item) {
  const sink = { label: "sink", span: matchSpan(item.line, item.column, item.match_text) };
  const origins = (item.lead.taint?.findings ?? []).map((finding) => ({
    label: originLabel(finding),
    span: originSpan(finding),
  }));
  return [sink, ...origins];
}

/** Libellé de l'étape courante : « i/n · étiquette · l. N ». */
export function stepCaption(steps, index) {
  const step = steps[index];
  if (!step) return `${steps.length} étape(s)`;
  const where = step.span ? `l. ${step.span[0]}` : "sans position";
  return `${index + 1}/${steps.length} · ${step.label} · ${where}`;
}
