/**
 * standalone/App.tsx — Coquille minimale de prévisualisation du portage
 * React : un onglet par vue déjà portée. Pas la vraie coquille de
 * paragone-front (`public/index.html` + `src/shell/`) -- juste assez pour
 * voir/tester les vues React les unes à côté des autres pendant le
 * portage. Remplacée par la vraie coquille quand toutes les vues existent.
 */
import { useState } from "react";
import type { ParagoneApi } from "../api/client";
import { ReferenceView } from "../views/Reference";
import { StatsView } from "../views/Stats";
import { CorpusView } from "../views/Corpus";

const TABS = [
  { id: "reference", label: "Référentiel" },
  { id: "stats", label: "Statistiques" },
  { id: "corpus", label: "Corpus" },
] as const;

export function App({ api }: { api: ParagoneApi }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("reference");
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
      </main>
    </>
  );
}
