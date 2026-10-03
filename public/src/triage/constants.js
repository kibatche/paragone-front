/**
 * @author [A likely boring stuff made by] Shevek
 * @desc constants.js — Constantes du triage : décisions et leurs touches, libellés des verdicts humains,
 *       modes (impact, inventaire), filtres, tailles de page, géométrie du code, aide du clavier.
 */

const KEEP = { score: "LEAD", key: "a", icon: "✓", css: "keep" };
const REJECT = { score: "REJECT", key: "r", label: "Rejeter", icon: "✗", css: "reject" };

/** Un lead d'impact se juge : on le retient, le rejette ou l'escalade. */
export const IMPACT_DECISIONS = [
  { ...KEEP, label: "Retenir" },
  REJECT,
  { score: "ESCALATE", key: "e", label: "Escalader", icon: "⤴", css: "escalate" },
];

/** Un inventaire se consulte : on le garde pour creuser, on le note, ou c'est du bruit. */
export const INVENTORY_DECISIONS = [
  { ...KEEP, label: "À creuser" },
  { score: "INFO", key: "i", label: "Noter", icon: "✎", css: "info" },
  { ...REJECT, label: "Bruit" },
];

export const HUMAN_LABELS = {
  LEAD: "retenu",
  REJECT: "rejeté",
  ESCALATE: "escaladé",
  CONFIRMED: "confirmé",
  DORMANT: "dormant",
  INFO: "info",
};

/** Libellés propres à l'inventaire, là où le mot du triage d'impact ne dit pas la même chose. */
export const INVENTORY_LABELS = { ...HUMAN_LABELS, LEAD: "à creuser", REJECT: "bruit", INFO: "noté" };

const MASK_DUPLICATES = { key: "showDuplicates", label: "doublons" };
const MASK_REVIEWED = { key: "showReviewed", label: "déjà triés" };

export const IMPACT_MODE = {
  name: "impact",
  kind: "impact",
  decisions: IMPACT_DECISIONS,
  otherScores: ["CONFIRMED", "DORMANT", "INFO"],
  labels: HUMAN_LABELS,
  masks: [
    MASK_DUPLICATES,
    { key: "showLiteral", label: "valeurs littérales" },
    { key: "showRejected", label: "rejetés par le juge" },
    MASK_REVIEWED,
  ],
  isJudged: true,
  classesOf: (vocabulary) => vocabulary.impactClasses,
  sinkTitle: "Le sink",
  help: "Ouvre un lead dans la file. Les plus prometteurs sont en tête : score du juge, puis verdict du taint.",
  keysHelp: [
    ["j", "k", "lead suivant / précédent"],
    ["←", "→", "étape du taint précédente / suivante"],
    ["a", "", "retenir"],
    ["r", "", "rejeter"],
    ["e", "", "escalader"],
    ["n", "", "commentaire"],
    ["u", "", "annuler le tri"],
    ["/", "", "rechercher"],
  ],
};

export const INVENTORY_MODE = {
  name: "inventory",
  kind: "inventory",
  decisions: INVENTORY_DECISIONS,
  otherScores: ["DORMANT"],
  labels: INVENTORY_LABELS,
  masks: [MASK_DUPLICATES, MASK_REVIEWED],
  isJudged: false,
  classesOf: (vocabulary) => vocabulary.inventoryClasses,
  sinkTitle: "Le match",
  help: "Ce que les analyzers d'inventaire ont relevé : chemins, hôtes, secrets, stockage, cookies. Rien n'est jugé ; la file sert à trier ce qui mérite la recon.",
  keysHelp: [
    ["j", "k", "élément suivant / précédent"],
    ["←", "→", "étape du code précédente / suivante"],
    ["a", "", "à creuser"],
    ["i", "", "noter"],
    ["r", "", "bruit"],
    ["n", "", "commentaire"],
    ["u", "", "annuler le tri"],
    ["/", "", "rechercher"],
  ],
};

/** Filtres de la file qui valent leur nom de paramètre d'API. */
export const FILTER_KEYS = ["class", "verdict", "score", "analyzer", "human", "unjudged", "q"];

export const SLOT_LABELS = {
  "call-argument": (slot) => `argument n°${slot.index ?? 0} de l'appel`,
  "object-property": (slot) => `valeur de la clé « ${slot.key ?? "?"} »`,
  "assignment-expression-right": () => "membre droit de l'affectation",
};

export const QUEUE_PAGE = 100;

/** Hauteur d'une ligne de code : DOIT égaler `.cline { height }` en CSS, c'est la base de la virtualisation. */
export const LINE_HEIGHT_PX = 22;
/** Largeur de la gouttière des numéros : DOIT égaler `.cline .ln { width }` en CSS. */
export const CODE_GUTTER_PX = 80;
/** Taquet de tabulation par défaut de CSS (`tab-size`). */
export const TAB_SIZE = 8;
/** Lignes rendues au-dessus et au-dessous de la partie visible du code. */
export const CODE_BUFFER = 12;

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
export const COMMAND_KEYS = {
  u: { name: "undo" },
  n: { name: "note" },
  "/": { name: "search" },
  ArrowLeft: { name: "stepBack" },
  ArrowRight: { name: "stepForward" },
  Escape: { name: "collapse" },
};
