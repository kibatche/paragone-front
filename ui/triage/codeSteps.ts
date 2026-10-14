/**
 * triage/codeSteps.ts — Port fidèle de `public/src/triage/code_steps.js` :
 * les étapes que la vue code parcourt pour un lead -- le sink, puis les
 * origines du taint dans l'ordre du dossier -- et les lignes à marquer.
 * Fonctions pures.
 */
import { SANITIZER_LABEL, SOURCE_KIND } from "./constants";

export type Finding = {
  id: number;
  kind: string;
  knownSource?: string;
  sanitizeMethod?: string;
  loc?: { start?: { line: number; column: number }; end?: { line: number; column: number } };
  text?: string;
  derivedFrom?: number;
  sourceString?: string;
  endReason?: string;
  path?: { role: string; label?: string }[];
};

export type Span = [number, number, number, number];

/** Le nœud traverse une méthode de désinfection : `sanitizeMethod` est absent ou vide sinon. */
export function isSanitized(finding: Finding): boolean {
  return Boolean(finding.sanitizeMethod);
}

/** Libellé court d'un nœud désinfectant : « désinfection : sanitize ». */
export function sanitizerLabel(finding: Finding): string {
  return `${SANITIZER_LABEL} : ${finding.sanitizeMethod}`;
}

/** Plage du texte du match à partir de sa position de départ. Le texte peut couvrir plusieurs lignes. */
export function matchSpan(line: number, column: number, text: string | null | undefined): Span {
  const rows = String(text ?? "").split("\n");
  if (rows.length === 1) return [line, column, line, column + rows[0].length];
  return [line, column, line + rows.length - 1, rows.at(-1)!.length];
}

function originSpan(finding: Finding): Span | null {
  const { start, end } = finding.loc ?? {};
  if (!start || !end) return null;
  return [start.line, start.column, end.line, end.column];
}

function originLabel(finding: Finding): string {
  if (finding.kind === SOURCE_KIND && finding.knownSource) return finding.knownSource;
  if (isSanitized(finding)) return sanitizerLabel(finding);
  return (finding.text ?? "").split("\n")[0].trim() || finding.kind;
}

/** Les numéros de ligne des origines, et parmi eux ceux des nœuds désinfectants. */
export function originLines(findings: Finding[]): { origin: Set<number>; sanitized: Set<number> } {
  const origin = new Set<number>();
  const sanitized = new Set<number>();
  for (const finding of findings) {
    const line = finding.loc?.start?.line;
    if (!line) continue;
    origin.add(line);
    if (isSanitized(finding)) sanitized.add(line);
  }
  return { origin, sanitized };
}

export type Step = { label: string; span: Span | null };

/** Le sink en premier ; `span` vaut null pour une origine sans position. */
export function codeSteps(item: {
  line: number;
  column: number;
  match_text: string;
  lead: { taint?: { findings?: Finding[] } };
}): Step[] {
  const sink: Step = { label: "sink", span: matchSpan(item.line, item.column, item.match_text) };
  const origins: Step[] = (item.lead.taint?.findings ?? []).map((finding) => ({
    label: originLabel(finding),
    span: originSpan(finding),
  }));
  return [sink, ...origins];
}

/** Libellé de l'étape courante : « i/n · étiquette · l. N ». */
export function stepCaption(steps: Step[], index: number): string {
  const step = steps[index];
  if (!step) return `${steps.length} étape(s)`;
  const where = step.span ? `l. ${step.span[0]}` : "sans position";
  return `${index + 1}/${steps.length} · ${step.label} · ${where}`;
}
