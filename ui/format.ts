/**
 * format.ts — Port fidèle de `public/src/common/format.js` : nombres,
 * dates, coûts, chemin court, emplacement, pourcentage, trous de motif,
 * distribution des probabilités, options lisibles, priorité. Fonctions
 * pures, aucune dépendance à l'hôte.
 */
export const JUDGE_SCORES = ["HIGH", "MEDIUM", "IN_DEPTH", "REJECT"] as const;

export function shortFile(path: string | null | undefined): string {
  return String(path ?? "")
    .split("/")
    .pop() as string;
}

export function where(file: string | null | undefined, line: number | null | undefined): string {
  return line === null || line === undefined ? shortFile(file) : `${shortFile(file)}:${line}`;
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("fr-FR").format(value ?? 0);
}

/** Coût en dollars, avec assez de décimales pour qu'un coût de quelques millièmes ne s'affiche pas zéro. */
export function formatCost(value: number | null | undefined): string {
  const cost = value ?? 0;
  return `${cost.toFixed(cost < 1 ? 5 : 2)} $`;
}

export function formatDate(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  return new Date(ms).toLocaleString("fr-FR");
}

export function percent(value: number | null | undefined): string {
  return `${Math.round((value ?? 0) * 100)} %`;
}

/** Découpe un motif en morceaux, ceux qui sont des trous (`EXPR`, `EXPR#2`) étant marqués. */
export function splitHoles(text: string | null | undefined): { text: string; hole: boolean }[] {
  const parts: { text: string; hole: boolean }[] = [];
  const source = String(text ?? "");
  let last = 0;
  for (const match of source.matchAll(/EXPR(?:#\d+)?/g)) {
    if (match.index! > last) parts.push({ text: source.slice(last, match.index), hole: false });
    parts.push({ text: match[0], hole: true });
    last = match.index! + match[0].length;
  }
  if (last < source.length) parts.push({ text: source.slice(last), hole: false });
  return parts;
}

/** Probabilités du juge dans l'ordre des scores, sans les nulles. */
export function distribution(probabilities: Record<string, number> = {}): { score: string; p: number }[] {
  return JUDGE_SCORES.map((score) => ({ score, p: probabilities[score] ?? 0 })).filter(({ p }) => p > 0);
}

/** Texte lisible des options d'une requête (`{ method: "POST" }` → `method: "POST"`). */
export function optionsText(options: Record<string, unknown> | null | undefined): string {
  if (!options || typeof options !== "object") return "";
  return Object.entries(options)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(", ");
}

/** Libellé court du sink d'une ligne de file : le porteur, ou le texte reconstruit quand il en dit plus. */
export function sinkText(row: { carrier?: string; reconstructed?: string }): string {
  return row.carrier ?? row.reconstructed ?? "";
}

/** Place du lead dans la file, de 0 (plus prometteur) à 3 : la pointe de couleur de sa ligne. */
export function priorityOf(row: { priority?: number | null }): number {
  return Math.min(3, Math.max(0, row.priority ?? 3));
}
