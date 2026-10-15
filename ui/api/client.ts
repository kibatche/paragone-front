/**
 * client.ts — Une fonction par opération du contrat OpenAPI de paragone,
 * identique en substance à l'ancien `public/src/common/api.js`, mais sans
 * aucune connaissance de l'hôte : chaque appel passe par un `Fetcher` injecté.
 * Paragone (servi en direct) et Hermes (via le proxy du plugin desktop) ne
 * sont que deux implémentations de ce `Fetcher` -- des serviteurs, pas des
 * dépendances de cette couche.
 */

export type FetcherOpts = { query?: Record<string, unknown>; body?: unknown };
export type Fetcher = (method: string, path: string, opts?: FetcherOpts) => Promise<unknown>;

export function makeApi(fetcher: Fetcher) {
  const get = (path: string, query?: Record<string, unknown>) => fetcher("GET", path, { query });

  return {
    getMeta: () => get("/meta"),
    getSummary: () => get("/summary"),
    getTokens: () => get("/tokens"),
    getVocabulary: () => get("/vocabulary"),
    listAnalyzers: () => get("/analyzers"),
    getConfig: () => get("/config"),
    putConfig: (config: unknown) => fetcher("PUT", "/config", { body: config }),
    startScan: () => fetcher("POST", "/scan"),
    startJudge: () => fetcher("POST", "/judge"),
    getJobs: () => get("/jobs"),

    listLeads: (filters?: Record<string, unknown>) => get("/leads", filters),
    countLeads: (filters?: Record<string, unknown>) => get("/leads/count", filters),
    getLead: (id: number | string) => get(`/lead/${id}`),
    getDossier: (id: number | string, lang?: string) => get(`/lead/${id}/dossier`, { lang }),
    listDuplicates: (id: number | string) => get(`/lead/${id}/duplicates`),
    setHuman: (id: number | string, review: unknown) => fetcher("POST", `/lead/${id}/human`, { body: review }),
    clearHuman: (id: number | string) => fetcher("DELETE", `/lead/${id}/human`),
    openInEditor: (id: number | string) => fetcher("POST", `/lead/${id}/open`),
    getSource: (id: number | string) => get("/source", { id }),

    listFiles: (filters?: Record<string, unknown>) => get("/files", filters),
    countFiles: (filters?: Record<string, unknown>) => get("/files/count", filters),
    listMatches: (filters?: Record<string, unknown>) => get("/matches", filters),
    countMatches: (filters?: Record<string, unknown>) => get("/matches/count", filters),
  };
}

export type ParagoneApi = ReturnType<typeof makeApi>;
