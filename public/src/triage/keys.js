/**
 * @author [A likely boring stuff made by] Shevek
 * @desc keys.js — Traduction d'une touche en geste de tri. Fonction pure : ni DOM, ni état.
 */

import { COMMAND_KEYS, IMPACT_DECISIONS, NAVIGATION_KEYS } from "./constants.js";

/**
 * @param isTyping vrai quand le focus est dans un champ de saisie
 * @param hasModifier vrai quand Ctrl, Alt ou Méta est tenu
 * @param decisions décisions du mode courant : seules leurs touches décident
 * @return `{ name, score? }`, ou null si la touche n'est pas un geste
 */
export function keyAction(key, { isTyping = false, hasModifier = false, decisions = IMPACT_DECISIONS } = {}) {
  if (hasModifier) return null;
  if (isTyping) return key === "Escape" ? { name: "blur" } : null;
  if (NAVIGATION_KEYS[key]) return NAVIGATION_KEYS[key];
  const decision = decisions.find((d) => d.key === key);
  if (decision) return { name: "decide", score: decision.score };
  return COMMAND_KEYS[key] ?? null;
}
