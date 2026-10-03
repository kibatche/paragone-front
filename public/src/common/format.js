/**
 * @author [A likely boring stuff made by] Shevek
 * @desc format.js — Fonctions pures de mise en forme et de lecture des données de l'API : emplacement,
 *       nombres, dates, trous de motif, meilleur jugement, distribution des probabilités.
 */

import { JUDGE_SCORES } from "./constants.js";

export function shortFile(path) {
  return String(path ?? "")
    .split("/")
    .pop();
}

export function where(file, line) {
  return line === null || line === undefined ? shortFile(file) : `${shortFile(file)}:${line}`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(value ?? 0);
}

/** Coût en dollars, avec assez de décimales pour qu'un coût de quelques millièmes ne s'affiche pas zéro. */
export function formatCost(value) {
  const cost = value ?? 0;
  return `${cost.toFixed(cost < 1 ? 5 : 2)} $`;
}

export function formatDate(ms) {
  if (ms === null || ms === undefined) return "—";
  return new Date(ms).toLocaleString("fr-FR");
}

export function formatDuration(startMs, endMs) {
  if (!startMs) return "—";
  const seconds = Math.max(0, Math.round(((endMs ?? Date.now()) - startMs) / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

export function percent(value) {
  return `${Math.round((value ?? 0) * 100)} %`;
}

/** Découpe un motif en morceaux, ceux qui sont des trous (`EXPR`, `EXPR#2`) étant marqués. */
export function splitHoles(text) {
  const parts = [];
  let last = 0;
  for (const match of String(text ?? "").matchAll(/EXPR(?:#\d+)?/g)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), hole: false });
    parts.push({ text: match[0], hole: true });
    last = match.index + match[0].length;
  }
  if (last < text?.length) parts.push({ text: text.slice(last), hole: false });
  return parts;
}

/** Meilleur jugement d'une liste : le score le plus prioritaire, puis la confiance la plus haute. */
export function bestJudgement(judgements = []) {
  const rank = (j) => JUDGE_SCORES.indexOf(j.score);
  return [...judgements].sort((a, b) => rank(a) - rank(b) || b.confidence - a.confidence)[0] ?? null;
}

/** Probabilités du juge dans l'ordre des scores, sans les nulles. */
export function distribution(probabilities = {}) {
  return JUDGE_SCORES.map((score) => ({ score, p: probabilities[score] ?? 0 })).filter(({ p }) => p > 0);
}

/** Texte lisible des options d'une requête (`{ method: "POST" }` → `method: "POST"`). */
export function optionsText(options) {
  if (!options || typeof options !== "object") return "";
  return Object.entries(options)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(", ");
}

/** Libellé court du sink d'une ligne de file : le porteur, ou le texte reconstruit quand il en dit plus. */
export function sinkText(row) {
  return row.carrier ?? row.reconstructed ?? "";
}

/** Place du lead dans la file, de 0 (plus prometteur) à 3 : la pointe de couleur de sa ligne. */
export function priorityOf(row) {
  return Math.min(3, Math.max(0, row.priority ?? 3));
}
