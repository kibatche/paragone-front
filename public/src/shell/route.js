/**
 * @author [A likely boring stuff made by] Shevek
 * @desc route.js — Lecture d'un fragment d'URL en route : nom et paramètres. Fonction pure.
 */

import { DEFAULT_ROUTE, ROUTES } from "./constants.js";

/** `#/corpus?tab=matches` → `{ name: "corpus", params }` ; une route inconnue retombe sur la route par défaut. */
export function parseRoute(hash) {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const isKnown = ROUTES.some((route) => route.name === path);
  return { name: isKnown ? path : DEFAULT_ROUTE, params: new URLSearchParams(query) };
}
