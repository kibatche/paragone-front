/**
 * triage/useTriage.ts — Port React fidèle de `public/src/triage/state.js` :
 * filtres, masques, file paginée, lead ouvert et son dossier, tri humain
 * avec annulation. La version vanilla notifie des abonnés (`emit`/
 * `subscribe`) ; ici un seul `useReducer`-like state React déclenche le
 * rendu directement -- même séquence d'opérations async, mêmes gardes de
 * génération contre les réponses tardives (une requête qui répond après
 * qu'on a changé de filtre ne doit jamais écraser l'état courant).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { ParagoneApi } from "../api/client";
import { FILTER_KEYS, IMPACT_MODE, QUEUE_PAGE, type Mode } from "./constants";
import type { DossierData, Duplicate, Lead, Source } from "./types";

export type QueueRow = {
  id: number;
  classes: string[];
  analyzer_name: string;
  method?: string | null;
  human_score?: string | null;
  priority?: number;
  carrier?: string;
  reconstructed?: string;
  file: string;
  line: number;
  verdict?: string;
  judgements?: { score: string }[];
};

export type TriageState = {
  mode: Mode;
  filters: Record<string, string>;
  masks: Record<string, boolean>;
  items: QueueRow[];
  total: number;
  hidden: Record<string, number>;
  isDone: boolean;
  selectedId: number | null;
  lead: Lead | null;
  dossier: DossierData | null;
  duplicates: Duplicate[];
  source: Source | null;
  sourceError: unknown;
  lang: string;
  lastDecision: { id: number; before: { score: string | null; note: string | null } | null } | null;
};

export type TriageApi = {
  state: TriageState;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  open: (id: number) => Promise<void>;
  setLang: (lang: string) => Promise<void>;
  setFilter: (key: string, value: string) => Promise<void>;
  setMask: (key: string, isOn: boolean) => Promise<void>;
  step: (delta: number) => Promise<void>;
  decide: (score: string, note?: string) => Promise<void>;
  undo: () => Promise<void>;
  clearReview: () => Promise<void>;
  openInEditor: (id: number) => Promise<unknown>;
};

/** Filtres initiaux lus dans la chaîne de requête de la route. */
export function filtersFromParams(params: URLSearchParams): Record<string, string> {
  const filters: Record<string, string> = {};
  for (const key of FILTER_KEYS) filters[key] = params.get(key) ?? "";
  return filters;
}

export function useTriage(
  api: ParagoneApi,
  mode: Mode = IMPACT_MODE,
  initialFilters: Record<string, string> = {},
): TriageApi {
  const [state, setState] = useState<TriageState>(() => ({
    mode,
    filters: { ...Object.fromEntries(FILTER_KEYS.map((key) => [key, ""])), ...initialFilters },
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
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const generation = useRef(0);
  const isLoading = useRef(false);

  const countParams = useCallback(
    () => ({ ...stateRef.current.filters, ...stateRef.current.masks, kind: mode.kind }),
    [mode.kind],
  );

  const nextAfter = (id: number) => {
    const items = stateRef.current.items;
    const index = items.findIndex((row) => row.id === id);
    return items[index + 1]?.id ?? items[index - 1]?.id ?? null;
  };

  const open = useCallback(
    async (id: number) => {
      setState((s) => ({
        ...s,
        selectedId: id,
        lead: null,
        dossier: null,
        duplicates: [],
        source: null,
        sourceError: null,
      }));
      const [lead, dossier, duplicates] = await Promise.all([
        api.getLead(id) as Promise<Lead>,
        api.getDossier(id, stateRef.current.lang) as Promise<DossierData>,
        api.listDuplicates(id) as Promise<Duplicate[]>,
      ]);
      if (stateRef.current.selectedId !== id) return;
      setState((s) => ({ ...s, lead, dossier, duplicates }));
      try {
        const source = (await api.getSource(id)) as Source;
        if (stateRef.current.selectedId === id) setState((s) => ({ ...s, source, sourceError: null }));
      } catch (error) {
        if (stateRef.current.selectedId === id) setState((s) => ({ ...s, sourceError: error }));
      }
    },
    [api],
  );

  const refreshCounts = useCallback(
    async (mine: number) => {
      const { total, hidden } = (await api.countLeads(countParams())) as {
        total: number;
        hidden: Record<string, number>;
      };
      if (mine !== generation.current) return;
      setState((s) => ({ ...s, total, hidden }));
    },
    [api, countParams],
  );

  const loadMore = useCallback(
    async (mine = generation.current) => {
      if (isLoading.current || stateRef.current.isDone) return;
      isLoading.current = true;
      const rows = (await api.listLeads({
        ...countParams(),
        limit: QUEUE_PAGE,
        offset: stateRef.current.items.length,
      })) as QueueRow[];
      isLoading.current = false;
      if (mine !== generation.current) return;
      const isDone = rows.length < QUEUE_PAGE;
      const openFirst = stateRef.current.selectedId === null && stateRef.current.items.length === 0 && rows.length > 0;
      setState((s) => ({ ...s, items: [...s.items, ...rows], isDone }));
      if (openFirst) await open(rows[0].id);
    },
    [api, countParams, open],
  );

  const reload = useCallback(async () => {
    const mine = ++generation.current;
    isLoading.current = false;
    setState((s) => ({ ...s, items: [], isDone: false }));
    await Promise.all([loadMore(mine), refreshCounts(mine)]);
  }, [loadMore, refreshCounts]);

  const setLang = useCallback(
    async (lang: string) => {
      setState((s) => ({ ...s, lang }));
      if (stateRef.current.selectedId === null) return;
      const dossier = (await api.getDossier(stateRef.current.selectedId, lang)) as DossierData;
      setState((s) => ({ ...s, dossier }));
    },
    [api],
  );

  const setFilter = useCallback(
    async (key: string, value: string) => {
      setState((s) => ({ ...s, filters: { ...s.filters, [key]: value }, selectedId: null }));
      await reload();
    },
    [reload],
  );

  const setMask = useCallback(
    async (key: string, isOn: boolean) => {
      setState((s) => ({ ...s, masks: { ...s.masks, [key]: isOn }, selectedId: null }));
      await reload();
    },
    [reload],
  );

  const step = useCallback(
    async (delta: number) => {
      const items = stateRef.current.items;
      const index = items.findIndex((row) => row.id === stateRef.current.selectedId);
      const next = items[Math.min(items.length - 1, Math.max(0, index + delta))];
      if (next && next.id !== stateRef.current.selectedId) return open(next.id);
      if (delta > 0) return loadMore();
    },
    [open, loadMore],
  );

  const refreshRow = useCallback(
    async (id: number) => {
      const row = stateRef.current.items.find((r) => r.id === id);
      if (!row) return;
      const detail = (await api.getLead(id)) as { human_score?: string | null };
      setState((s) => ({
        ...s,
        items: s.items.map((r) => (r.id === id ? { ...r, human_score: detail.human_score } : r)),
      }));
    },
    [api],
  );

  const decide = useCallback(
    async (score: string, note = "") => {
      const id = stateRef.current.selectedId;
      if (id === null) return;
      const before = stateRef.current.lead ? { score: stateRef.current.lead.human_score ?? null, note: stateRef.current.lead.human_note ?? null } : null;
      await api.setHuman(id, { human_score: score, human_note: note });
      setState((s) => ({ ...s, lastDecision: { id, before } }));
      if (stateRef.current.masks.showReviewed) {
        await refreshRow(id);
        await open(id);
        return;
      }
      const next = nextAfter(id);
      setState((s) => ({ ...s, items: s.items.filter((row) => row.id !== id), total: Math.max(0, s.total - 1) }));
      if (next === null) {
        setState((s) => ({ ...s, selectedId: null, lead: null }));
        return;
      }
      await open(next);
    },
    [api, open, refreshRow],
  );

  const undo = useCallback(async () => {
    const last = stateRef.current.lastDecision;
    if (!last) return;
    setState((s) => ({ ...s, lastDecision: null }));
    if (last.before?.score) {
      await api.setHuman(last.id, { human_score: last.before.score, human_note: last.before.note ?? "" });
    } else {
      await api.clearHuman(last.id);
    }
    setState((s) => ({ ...s, selectedId: last.id }));
    await reload();
    await open(last.id);
  }, [api, reload, open]);

  const clearReview = useCallback(async () => {
    const id = stateRef.current.selectedId;
    if (id === null) return;
    await api.clearHuman(id);
    setState((s) => ({ ...s, lastDecision: null }));
    await refreshRow(id);
    await open(id);
    await refreshCounts(generation.current);
  }, [api, refreshRow, open, refreshCounts]);

  const openInEditor = useCallback((id: number) => api.openInEditor(id), [api]);

  return useMemo(
    () => ({
      state,
      reload,
      loadMore: () => loadMore(),
      open,
      setLang,
      setFilter,
      setMask,
      step,
      decide,
      undo,
      clearReview,
      openInEditor,
    }),
    [state, reload, loadMore, open, setLang, setFilter, setMask, step, decide, undo, clearReview, openInEditor],
  );
}
