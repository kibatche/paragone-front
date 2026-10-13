/**
 * format.ts — Port fidèle de `public/src/common/format.js` (sous-ensemble
 * utilisé par les vues Statistiques/Corpus) : nombres, dates, coûts,
 * chemin court. Fonctions pures, aucune dépendance à l'hôte.
 */
export function shortFile(path: string | null | undefined): string {
  return String(path ?? "")
    .split("/")
    .pop() as string;
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
