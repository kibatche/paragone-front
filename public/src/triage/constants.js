/**
 * @author [A likely boring stuff made by] Shevek
 * @desc constants.js — Constantes du triage : décisions et leurs touches, libellés des verdicts humains,
 *       masques de la file, filtres, tailles de page, emplacements, aide du clavier.
 */

/** Les trois décisions rapides : verdict humain enregistré, touche, libellé. */
export const DECISIONS = [
  { score: "LEAD", key: "a", label: "Retenir", icon: "✓", css: "keep" },
  { score: "REJECT", key: "r", label: "Rejeter", icon: "✗", css: "reject" },
  { score: "ESCALATE", key: "e", label: "Escalader", icon: "⤴", css: "escalate" },
];

export const OTHER_HUMAN_SCORES = ["CONFIRMED", "DORMANT", "INFO"];

export const HUMAN_LABELS = {
  LEAD: "retenu",
  REJECT: "rejeté",
  ESCALATE: "escaladé",
  CONFIRMED: "confirmé",
  DORMANT: "dormant",
  INFO: "info",
};

export const MASKS = [
  { key: "showInventory", label: "inventaire" },
  { key: "showDuplicates", label: "doublons" },
  { key: "showLiteral", label: "valeurs littérales" },
  { key: "showRejected", label: "rejetés par le juge" },
  { key: "showReviewed", label: "déjà triés" },
];

/** Filtres de la file qui valent leur nom de paramètre d'API. */
export const FILTER_KEYS = ["class", "kind", "verdict", "score", "analyzer", "human", "unjudged", "q"];

export const SLOT_LABELS = {
  "call-argument": (slot) => `argument n°${slot.index ?? 0} de l'appel`,
  "object-property": (slot) => `valeur de la clé « ${slot.key ?? "?"} »`,
  "assignment-expression-right": () => "membre droit de l'affectation",
};

export const QUEUE_PAGE = 100;
export const CODE_CONTEXT_LINES = 60;
export const CODE_LINE_LIMIT = 800;

/** Score d'une classe d'impact que le juge n'a pas encore vue. */
export const UNJUDGED = "UNJUDGED";

/** Fin de descente du taint qui continue : au-delà, la chaîne s'arrête sur une source ou un arrêt. */
export const SOURCE_KIND = "INTERNAL";

export const NAVIGATION_KEYS = {
  j: { name: "next" },
  k: { name: "previous" },
  ArrowDown: { name: "next" },
  ArrowUp: { name: "previous" },
};
export const COMMAND_KEYS = { u: { name: "undo" }, n: { name: "note" }, "/": { name: "search" } };

export const HELP =
  "Ouvre un lead dans la file. Les plus prometteurs sont en tête : score du juge, puis verdict du taint.";

export const KEYS_HELP = [
  ["j", "k", "lead suivant / précédent"],
  ["a", "", "retenir"],
  ["r", "", "rejeter"],
  ["e", "", "escalader"],
  ["n", "", "commentaire"],
  ["u", "", "annuler le tri"],
  ["/", "", "rechercher"],
];
