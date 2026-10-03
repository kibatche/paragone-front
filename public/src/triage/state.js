/**
 * @author [A likely boring stuff made by] Shevek
 * @desc state.js — Logique du triage : filtres, masques, file paginée, lead ouvert et son dossier, tri
 *       humain avec annulation. Notifie ses abonnés de chaque changement ; ne rend rien.
 */

import * as api from "../common/api.js";
import { FILTER_KEYS, IMPACT_MODE, QUEUE_PAGE } from "./constants.js";

/** Filtres initiaux lus dans la chaîne de requête de la route (`#/triage?class=XSS`). */
export function filtersFromParams(params) {
  const filters = {};
  for (const key of FILTER_KEYS) filters[key] = params.get(key) ?? "";
  return filters;
}

/** @param mode IMPACT_MODE ou INVENTORY_MODE : fixe la nature des leads de la file (`kind`). */
export function createTriage(mode = IMPACT_MODE) {
  const listeners = new Set();
  const state = {
    filters: Object.fromEntries(FILTER_KEYS.map((key) => [key, ""])),
    masks: {},
    items: [],
    total: 0,
    hidden: {},
    isDone: false,
    selectedId: null,
    lead: null,
    dossier: null,
    duplicates: [],
    source: null,
    sourceError: null,
    lang: "fr",
    lastDecision: null,
  };
  let generation = 0;
  let isLoading = false;

  const emit = (name, detail = {}) => {
    for (const listener of listeners) listener(name, detail);
  };

  const countParams = () => ({ ...state.filters, ...state.masks, kind: mode.kind });

  const queueParams = (offset) => ({ ...countParams(), limit: QUEUE_PAGE, offset });

  const nextAfter = (id) => {
    const index = state.items.findIndex((row) => row.id === id);
    return (state.items[index + 1] ?? state.items[index - 1])?.id ?? null;
  };

  async function reload() {
    const mine = ++generation;
    isLoading = false;
    state.items = [];
    state.isDone = false;
    emit("queue");
    await Promise.all([loadMore(mine), refreshCounts(mine)]);
  }

  async function refreshCounts(mine = generation) {
    const { total, hidden } = await api.countLeads(countParams());
    if (mine !== generation) return;
    state.total = total;
    state.hidden = hidden;
    emit("counts");
  }

  async function loadMore(mine = generation) {
    if (isLoading || state.isDone) return;
    isLoading = true;
    const rows = await api.listLeads(queueParams(state.items.length));
    isLoading = false;
    if (mine !== generation) return;
    state.items.push(...rows);
    state.isDone = rows.length < QUEUE_PAGE;
    emit("append", { rows });
    if (state.selectedId === null && state.items.length) await open(state.items[0].id);
  }

  async function loadSource(id) {
    try {
      const source = await api.getSource(id);
      if (state.selectedId === id) state.source = source;
    } catch (error) {
      if (state.selectedId === id) state.sourceError = error;
    }
    if (state.selectedId === id) emit("source");
  }

  async function open(id) {
    state.selectedId = id;
    state.lead = null;
    state.dossier = null;
    state.duplicates = [];
    state.source = null;
    state.sourceError = null;
    emit("selection");
    const [lead, dossier, duplicates] = await Promise.all([
      api.getLead(id),
      api.getDossier(id, state.lang),
      api.listDuplicates(id),
    ]);
    if (state.selectedId !== id) return;
    Object.assign(state, { lead, dossier, duplicates });
    emit("dossier");
    await loadSource(id);
  }

  async function setLang(lang) {
    state.lang = lang;
    if (state.selectedId === null) return;
    state.dossier = await api.getDossier(state.selectedId, lang);
    emit("dossier");
  }

  function setFilter(key, value) {
    state.filters[key] = value;
    state.selectedId = null;
    return reload();
  }

  function setMask(key, isOn) {
    state.masks[key] = isOn;
    state.selectedId = null;
    return reload();
  }

  function step(delta) {
    const index = state.items.findIndex((row) => row.id === state.selectedId);
    const next = state.items[Math.min(state.items.length - 1, Math.max(0, index + delta))];
    if (next && next.id !== state.selectedId) return open(next.id);
    if (delta > 0) return loadMore();
    return Promise.resolve();
  }

  async function refreshRow(id) {
    const row = state.items.find((r) => r.id === id);
    if (!row) return;
    const detail = await api.getLead(id);
    Object.assign(row, { human_score: detail.human_score, reviewed_at: detail.reviewed_at });
    emit("row", { id });
  }

  /** Enregistre un verdict humain ; le lead trié quitte la file sauf si « déjà triés » est affiché. */
  async function decide(score, note = "") {
    const id = state.selectedId;
    if (id === null) return;
    const before = state.lead ? { score: state.lead.human_score, note: state.lead.human_note } : null;
    await api.setHuman(id, { human_score: score, human_note: note });
    state.lastDecision = { id, before };
    emit("decided", { id, score });
    if (state.masks.showReviewed) {
      await refreshRow(id);
      await open(id);
      return;
    }
    const next = nextAfter(id);
    state.items = state.items.filter((row) => row.id !== id);
    state.total = Math.max(0, state.total - 1);
    emit("remove", { id });
    emit("counts");
    if (next === null) {
      state.selectedId = null;
      emit("empty");
      return;
    }
    await open(next);
  }

  /** Annule le dernier tri : remet le verdict d'avant, ou l'efface s'il n'y en avait pas. */
  async function undo() {
    const last = state.lastDecision;
    if (!last) return;
    state.lastDecision = null;
    if (last.before?.score) {
      await api.setHuman(last.id, { human_score: last.before.score, human_note: last.before.note ?? "" });
    } else {
      await api.clearHuman(last.id);
    }
    state.selectedId = last.id;
    await reload();
    await open(last.id);
  }

  async function clearReview() {
    const id = state.selectedId;
    if (id === null) return;
    await api.clearHuman(id);
    state.lastDecision = null;
    await refreshRow(id);
    await open(id);
    await refreshCounts();
  }

  return {
    mode,
    state,
    reload,
    loadMore,
    open,
    setLang,
    setFilter,
    setMask,
    step,
    decide,
    undo,
    clearReview,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
