/**
 * triage/constants.ts — Port fidèle de `public/src/triage/constants.js` :
 * décisions et leurs touches, libellés, modes (impact, inventaire),
 * filtres, pagination, navigation clavier.
 */
export type Decision = { score: string; key: string; label: string; icon: string; css: string };

const KEEP = { score: "LEAD", key: "a", icon: "✓", css: "keep" };
const REJECT = { score: "REJECT", key: "r", label: "Rejeter", icon: "✗", css: "reject" };

/** Un lead d'impact se juge : on le retient, le rejette ou l'escalade. */
export const IMPACT_DECISIONS: Decision[] = [
  { ...KEEP, label: "Retenir" },
  REJECT,
  { score: "ESCALATE", key: "e", label: "Escalader", icon: "⤴", css: "escalate" },
];

/** Un inventaire se consulte : on le garde pour creuser, on le note, ou c'est du bruit. */
export const INVENTORY_DECISIONS: Decision[] = [
  { ...KEEP, label: "À creuser" },
  { score: "INFO", key: "i", label: "Noter", icon: "✎", css: "info" },
  { ...REJECT, label: "Bruit" },
];

export const HUMAN_LABELS: Record<string, string> = {
  LEAD: "retenu",
  REJECT: "rejeté",
  ESCALATE: "escaladé",
  CONFIRMED: "confirmé",
  DORMANT: "dormant",
  INFO: "info",
};

/** Libellés propres à l'inventaire, là où le mot du triage d'impact ne dit pas la même chose. */
export const INVENTORY_LABELS: Record<string, string> = {
  ...HUMAN_LABELS,
  LEAD: "à creuser",
  REJECT: "bruit",
  INFO: "noté",
};

const MASK_DUPLICATES = { key: "showDuplicates", label: "doublons" };
const MASK_REVIEWED = { key: "showReviewed", label: "déjà triés" };

export type Mode = {
  name: string;
  kind: string;
  decisions: Decision[];
  otherScores: string[];
  labels: Record<string, string>;
  masks: { key: string; label: string }[];
  isJudged: boolean;
  classesOf: (vocabulary: Record<string, unknown>) => string[];
  sinkTitle: string;
  help: string;
  keysHelp: [string, string, string][];
};

export const IMPACT_MODE: Mode = {
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
  classesOf: (vocabulary) => (vocabulary.impactClasses as string[] | undefined) ?? [],
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

export const INVENTORY_MODE: Mode = {
  name: "inventory",
  kind: "inventory",
  decisions: INVENTORY_DECISIONS,
  otherScores: ["DORMANT"],
  labels: INVENTORY_LABELS,
  masks: [MASK_DUPLICATES, MASK_REVIEWED],
  isJudged: false,
  classesOf: (vocabulary) => (vocabulary.inventoryClasses as string[] | undefined) ?? [],
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
export const FILTER_KEYS = ["class", "verdict", "score", "analyzer", "human", "unjudged", "q"] as const;

export const SLOT_LABELS: Record<string, (slot: { index?: number; key?: string }) => string> = {
  "call-argument": (slot) => `argument n°${slot.index ?? 0} de l'appel`,
  "object-property": (slot) => `valeur de la clé « ${slot.key ?? "?"} »`,
  "assignment-expression-right": () => "membre droit de l'affectation",
};

export const QUEUE_PAGE = 100;

/** Score d'une classe d'impact que le juge n'a pas encore vue. */
export const UNJUDGED = "UNJUDGED";

/** Fin de descente du taint qui continue : au-delà, la chaîne s'arrête sur une source ou un arrêt. */
export const SOURCE_KIND = "INTERNAL";

/** Libellé d'un nœud de teinte qui traverse une méthode de désinfection (`finding.sanitizeMethod`). */
export const SANITIZER_LABEL = "désinfection";

export const NAVIGATION_KEYS: Record<string, { name: string }> = {
  j: { name: "next" },
  k: { name: "previous" },
  ArrowDown: { name: "next" },
  ArrowUp: { name: "previous" },
};
export const COMMAND_KEYS: Record<string, { name: string }> = {
  u: { name: "undo" },
  n: { name: "note" },
  "/": { name: "search" },
  ArrowLeft: { name: "stepBack" },
  ArrowRight: { name: "stepForward" },
  Escape: { name: "collapse" },
};
