/**
 * query.ts — Encodage de paramètres de requête, partagé par tous les hôtes
 * (navigateur direct contre paragone, proxy Hermes). Même logique que
 * l'ancien `common/api.js::buildQuery` : paires vides/null/undefined
 * omises, booléens en 0/1.
 */
export function buildQuery(params: Record<string, unknown> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === "" || value === null || value === undefined) continue;
    query.set(key, typeof value === "boolean" ? String(Number(value)) : String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}
