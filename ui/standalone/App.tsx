/**
 * standalone/App.tsx — Coquille minimale de prévisualisation du portage
 * React : un onglet par vue déjà portée. Pas la vraie coquille de
 * paragone-front (`public/index.html` + `src/shell/`) -- juste assez pour
 * voir/tester les vues React les unes à côté des autres pendant le
 * portage. Remplacée par la vraie coquille quand toutes les vues existent.
 *
 * Routage par le hash (`#/<onglet>?<filtres>`) : voir `shell/hash.ts` pour
 * le pourquoi (port fidèle de `shell/route.js`, deep links/retour arrière
 * réels puisque ce build possède toute la fenêtre -- contrairement au
 * plugin Hermes, qui NE fait PAS ça, cf le commentaire de `shell/hash.ts`).
 */
import { useEffect, useState } from "react";
import type { ParagoneApi } from "../api/client";
import { ReferenceView } from "../views/Reference";
import { StatsView } from "../views/Stats";
import { CorpusView } from "../views/Corpus";
import { TriageView } from "../views/Triage";
import { JobsView } from "../views/Jobs";
import { filtersFromParams } from "../triage/useTriage";
import { navigateHash, resolveRouteName, useHash } from "../shell/hash";
import { IMPACT_MODE, INVENTORY_MODE } from "../triage/constants";
import type { Vocabulary } from "../triage/types";

/** Ordre et route par défaut : `public/src/shell/constants.js::ROUTES`/`DEFAULT_ROUTE` du front vanilla -- ce n'est pas arbitraire, ça reflète le flow réel (on triage d'abord, le reste est secondaire). */
const TABS = [
  { id: "triage", label: "Triage" },
  { id: "inventory", label: "Inventaires" },
  { id: "corpus", label: "Corpus" },
  { id: "stats", label: "Statistiques" },
  { id: "reference", label: "Référentiel" },
  { id: "jobs", label: "Scan & Juge" },
] as const;

const TAB_IDS = TABS.map((t) => t.id);
const DEFAULT_TAB = "triage";

export function App({ api }: { api: ParagoneApi }) {
  const { path, params } = useHash();
  const tab = resolveRouteName(path, TAB_IDS, DEFAULT_TAB) as (typeof TABS)[number]["id"];
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);

  useEffect(() => {
    api
      .getVocabulary()
      .then((v) => setVocabulary(v as Vocabulary))
      .catch(() => setVocabulary(null));
  }, [api]);

  const persistFilters = (filters: Record<string, string>) => navigateHash(tab, filters);

  return (
    <>
      <header className="app-head">
        <span className="brand">paragone</span>
        <nav id="nav">
          {TABS.map((t) => (
            <a key={t.id} className={tab === t.id ? "on" : ""} onClick={() => navigateHash(t.id)}>
              {t.label}
            </a>
          ))}
        </nav>
      </header>
      <main id="view">
        {tab === "reference" ? <ReferenceView api={api} /> : null}
        {tab === "stats" ? (
          <StatsView api={api} onOpenTriage={(filter, value) => navigateHash("triage", { [filter]: value })} />
        ) : null}
        {tab === "corpus" ? <CorpusView api={api} /> : null}
        {tab === "triage" ? (
          <TriageView
            api={api}
            vocabulary={vocabulary}
            mode={IMPACT_MODE}
            initialFilters={filtersFromParams(params)}
            onFiltersChange={persistFilters}
            autoFocus
          />
        ) : null}
        {tab === "inventory" ? (
          <TriageView
            api={api}
            vocabulary={vocabulary}
            mode={INVENTORY_MODE}
            initialFilters={filtersFromParams(params)}
            onFiltersChange={persistFilters}
            autoFocus
          />
        ) : null}
        {tab === "jobs" ? <JobsView api={api} vocabulary={vocabulary} /> : null}
      </main>
    </>
  );
}
