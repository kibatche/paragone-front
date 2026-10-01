/**
 * @author [A likely boring stuff made by] Shevek
 * @desc constants.js — Constantes des statistiques : répartitions affichées et filtre de triage que chacune ouvre.
 */

export const SPLITS = [
  { title: "Par classe", rows: "byClass", filter: "class" },
  { title: "Par verdict du taint", rows: "byVerdict", filter: "verdict" },
  { title: "Par score du juge", rows: "byAgentScore", filter: "score" },
  { title: "Par analyzer", rows: "byAnalyzer", filter: "analyzer" },
  { title: "Fichiers par statut", rows: "byFileStatus", filter: null },
];
