/**
 * standalone/App.tsx — Coquille minimale de prévisualisation du portage
 * React : un onglet par vue déjà portée. Pas la vraie coquille de
 * paragone-front (`public/index.html` + `src/shell/`) -- juste assez pour
 * voir/tester les vues React les unes à côté des autres pendant le
 * portage. Remplacée par la vraie coquille quand toutes les vues existent.
 */
import { useEffect, useState } from "react";
import type { ParagoneApi } from "../api/client";
import { ReferenceView } from "../views/Reference";
import { StatsView } from "../views/Stats";
import { CorpusView } from "../views/Corpus";
import { TriageView } from "../views/Triage";
import { IMPACT_MODE, INVENTORY_MODE } from "../triage/constants";
import type { Vocabulary } from "../triage/types";

/** Ordre et route par défaut : `public/src/shell/constants.js::ROUTES`/`DEFAULT_ROUTE` du front vanilla -- ce n'est pas arbitraire, ça reflète le flow réel (on triage d'abord, le reste est secondaire). "Travaux" (jobs) n'est pas encore porté. */
const TABS = [
  { id: "triage", label: "Triage" },
  { id: "inventory", label: "Inventaires" },
  { id: "corpus", label: "Corpus" },
  { id: "stats", label: "Statistiques" },
  { id: "reference", label: "Référentiel" },
] as const;

export function App({ api }: { api: ParagoneApi }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("triage");
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);

  useEffect(() => {
    api
      .getVocabulary()
      .then((v) => setVocabulary(v as Vocabulary))
      .catch(() => setVocabulary(null));
  }, [api]);

  return (
    <>
      <header className="app-head">
        <span className="brand">paragone (react, en cours de portage)</span>
        <nav id="nav">
          {TABS.map((t) => (
            <a key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </a>
          ))}
        </nav>
      </header>
      <main id="view">
        {tab === "reference" ? <ReferenceView api={api} /> : null}
        {tab === "stats" ? <StatsView api={api} /> : null}
        {tab === "corpus" ? <CorpusView api={api} /> : null}
        {tab === "triage" ? <TriageView api={api} vocabulary={vocabulary} mode={IMPACT_MODE} /> : null}
        {tab === "inventory" ? <TriageView api={api} vocabulary={vocabulary} mode={INVENTORY_MODE} /> : null}
      </main>
    </>
  );
}
