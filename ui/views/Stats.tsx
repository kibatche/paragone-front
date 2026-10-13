/**
 * Stats.tsx — Port React fidèle de `public/src/stats/view.js` +
 * `stats/constants.js` : compteurs et répartitions (`/summary`), usage et
 * coût du juge (`/tokens`). Un clic sur une répartition ouvre le triage
 * ainsi filtré -- `onOpenTriage` est optionnel, câblé à rien tant que la
 * vue Triage (Phase 3) n'existe pas côté React.
 */
import { useEffect, useState } from "react";
import type { ParagoneApi } from "../api/client";
import { formatCost, formatDate, formatNumber } from "../format";
import { BarList, DataTable, ErrorMessage, Section, Tile } from "../components/widgets";

const SPLITS: { title: string; rows: string; filter: string | null }[] = [
  { title: "Par classe", rows: "byClass", filter: "class" },
  { title: "Par verdict du taint", rows: "byVerdict", filter: "verdict" },
  { title: "Par score du juge", rows: "byAgentScore", filter: "score" },
  { title: "Par analyzer", rows: "byAnalyzer", filter: "analyzer" },
  { title: "Fichiers par statut", rows: "byFileStatus", filter: null },
];

type Summary = {
  totals: { total: number; agent_judged: number; human_reviewed: number };
  byClass: { k: string; n: number }[];
  byVerdict: { k: string; n: number }[];
  byAgentScore: { k: string; n: number }[];
  byAnalyzer: { k: string; n: number }[];
  byFileStatus: { k: string; n: number }[];
  [key: string]: unknown;
};

type TokenRun = {
  run_id: string;
  started_at: number;
  classes: string[];
  phases: string[];
  batches: number;
  input: number;
  output: number;
  cost: number;
};
type TokenByClass = { sink_type: string; phase: string; batches: number; input: number; output: number; cost: number };
type TokenUsage = { input: number; output: number; total: number };
type Tokens = {
  summary: {
    batches: number;
    runs: number;
    input: number;
    output: number;
    cache_read: number;
    cache_write: number;
    total: number;
    cost: number;
  };
  runs: TokenRun[];
  byClass: TokenByClass[];
  byPhase: Record<string, TokenUsage>;
};

function SummaryBlock({
  summary,
  onOpenTriage,
}: {
  summary: Summary;
  onOpenTriage?: (filter: string, value: string) => void;
}) {
  return (
    <>
      <div className="tiles">
        <Tile label="leads" value={summary.totals.total} />
        <Tile label="jugés par le juge" value={summary.totals.agent_judged} />
        <Tile label="triés par moi" value={summary.totals.human_reviewed} />
      </div>
      <div className="grid-2">
        {SPLITS.map((split) => (
          <Section key={split.title} title={split.title} aside={split.filter ? "cliquer ouvre le triage filtré" : null}>
            <BarList
              rows={summary[split.rows] as { k: string; n: number }[]}
              onPick={split.filter && onOpenTriage ? (value) => onOpenTriage(split.filter!, value) : undefined}
            />
          </Section>
        ))}
      </div>
    </>
  );
}

function TokenTiles({ summary }: { summary: Tokens["summary"] }) {
  return (
    <div className="tiles">
      <Tile label="lots" value={summary.batches} />
      <Tile label="lancements" value={summary.runs} />
      <Tile label="tokens en entrée" value={summary.input} />
      <Tile label="tokens en sortie" value={summary.output} />
      <Tile label="lus en cache" value={summary.cache_read} />
      <Tile label="écrits en cache" value={summary.cache_write} />
      <Tile label="total" value={summary.total} />
      <Tile label="coût" value={formatCost(summary.cost)} />
    </div>
  );
}

function TokensBlock({ tokens }: { tokens: Tokens }) {
  return (
    <>
      <TokenTiles summary={tokens.summary} />
      <Section title="Par lancement" aside={null}>
        <DataTable<TokenRun>
          columns={[
            { title: "lancement", cell: (r) => <span className="mono">{r.run_id}</span> },
            { title: "début", cell: (r) => formatDate(r.started_at) },
            { title: "classes", cell: (r) => r.classes.join(", ") },
            { title: "phases", cell: (r) => r.phases.join(", ") },
            { title: "lots", cell: (r) => String(r.batches) },
            { title: "entrée", cell: (r) => formatNumber(r.input) },
            { title: "sortie", cell: (r) => formatNumber(r.output) },
            { title: "coût", cell: (r) => formatCost(r.cost) },
          ]}
          rows={tokens.runs}
        />
      </Section>
      <Section title="Par classe" aside={null}>
        <DataTable<TokenByClass>
          columns={[
            { title: "classe", cell: (r) => r.sink_type },
            { title: "phase", cell: (r) => r.phase },
            { title: "lots", cell: (r) => String(r.batches) },
            { title: "entrée", cell: (r) => formatNumber(r.input) },
            { title: "sortie", cell: (r) => formatNumber(r.output) },
            { title: "coût", cell: (r) => formatCost(r.cost) },
          ]}
          rows={tokens.byClass}
        />
      </Section>
      <Section title="Par phase" aside={null}>
        <DataTable<[string, TokenUsage]>
          columns={[
            { title: "phase", cell: ([phase]) => phase },
            { title: "entrée", cell: ([, u]) => formatNumber(u.input) },
            { title: "sortie", cell: ([, u]) => formatNumber(u.output) },
            { title: "total", cell: ([, u]) => formatNumber(u.total) },
          ]}
          rows={Object.entries(tokens.byPhase)}
        />
      </Section>
    </>
  );
}

export function StatsView({
  api,
  onOpenTriage,
}: {
  api: ParagoneApi;
  onOpenTriage?: (filter: string, value: string) => void;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getSummary(), api.getTokens()])
      .then(([s, t]) => {
        if (cancelled) return;
        setSummary(s as Summary);
        setTokens(t as Tokens);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (error) return <ErrorMessage error={error} />;
  if (!summary || !tokens) return <div>chargement…</div>;

  return (
    <div className="page">
      <h2>Statistiques</h2>
      <SummaryBlock summary={summary} onOpenTriage={onOpenTriage} />
      <h2>Usage du juge</h2>
      <TokensBlock tokens={tokens} />
    </div>
  );
}
