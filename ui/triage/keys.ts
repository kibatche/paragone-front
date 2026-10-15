/**
 * triage/keys.ts — Port fidèle de `public/src/triage/keys.js` : traduction
 * d'une touche en geste de tri. Fonction pure : ni DOM, ni état.
 */
import { COMMAND_KEYS, IMPACT_DECISIONS, NAVIGATION_KEYS, type Decision } from "./constants";

export type KeyAction = { name: string; score?: string };

export function keyAction(
  key: string,
  {
    isTyping = false,
    hasModifier = false,
    decisions = IMPACT_DECISIONS,
  }: { isTyping?: boolean; hasModifier?: boolean; decisions?: Decision[] } = {},
): KeyAction | null {
  if (hasModifier) return null;
  if (isTyping) return key === "Escape" ? { name: "blur" } : null;
  if (NAVIGATION_KEYS[key]) return NAVIGATION_KEYS[key];
  const decision = decisions.find((d) => d.key === key);
  if (decision) return { name: "decide", score: decision.score };
  return COMMAND_KEYS[key] ?? null;
}
