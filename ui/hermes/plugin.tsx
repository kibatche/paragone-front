/**
 * hermes/plugin.tsx — Point d'entrée du plugin desktop Hermes. Tout ce qui
 * est générique à panoptika (menu de briques, cycle de vie, explorateur
 * d'API) vit ICI -- ce n'est pas réutilisable hors Hermes. Les vraies vues
 * de paragone (ReferenceView, et les suivantes) viennent de `../views/*`,
 * identiques au build autonome : seul le `Fetcher` change, il passe par
 * `ctx.rest` (le proxy server-to-server de `dashboard/plugin_api.py`)
 * plutôt que par un `fetch` direct. Build : voir `build:panoptika` dans
 * `package.json` -- bundle unique, `react`/`react/jsx-runtime`/
 * `@hermes/plugin-sdk` externalisés (déjà fournis par l'hôte desktop).
 */
import { Button, ROUTES_AREA, SIDEBAR_NAV_AREA, StatusDot, host } from "@hermes/plugin-sdk";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { makeApi, type Fetcher, type ParagoneApi } from "../api/client";
import { buildQuery } from "../api/query";
import { skinCss } from "./skin.generated";
import { ReferenceView } from "../views/Reference";
import { StatsView } from "../views/Stats";
import { CorpusView } from "../views/Corpus";
import { TriageView } from "../views/Triage";
import { JobsView } from "../views/Jobs";
import { FsBrowser } from "../components/FsBrowser";
import { IMPACT_MODE, INVENTORY_MODE } from "../triage/constants";
import type { Vocabulary } from "../triage/types";

type RestFn = (path: string, opts?: { method?: string; body?: unknown }) => Promise<unknown>;

type Brick = { id: string; label: string; running: boolean; healthy: boolean; base_url: string; cwd?: string };

type OpenApiDoc = { paths?: Record<string, { get?: unknown }> };

/** Only GET, no path params ({id} etc.) -- those need a value we don't have a form for yet. */
function simpleGetPaths(openapi: unknown): string[] {
  const doc = openapi as OpenApiDoc;
  if (!doc || typeof doc !== "object" || !doc.paths) return [];
  return Object.entries(doc.paths)
    .filter(([path, methods]) => methods?.get && !path.includes("{"))
    .map(([path]) => path)
    .sort();
}

/** Builds a Fetcher that proxies through our plugin_api.py namespace for one brick. */
function fetcherFor(rest: RestFn, ns: string): Fetcher {
  return async (method, path, opts = {}) => {
    const url = `${ns}/api${path}${buildQuery(opts.query)}`;
    return rest(url, { method, body: opts.body });
  };
}

function BrickMenu({
  bricks,
  selected,
  onSelect,
}: {
  bricks: Brick[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 border-r border-(--ui-stroke-secondary) pr-3 min-w-[140px]">
      {bricks.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onSelect(b.id)}
          className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-left ${
            b.id === selected ? "bg-(--ui-accent) text-white" : ""
          }`}
        >
          <span>{b.label}</span>
          <span className="text-xs opacity-70">{b.healthy ? "●" : "○"}</span>
        </button>
      ))}
    </div>
  );
}

function ApiExplorer({ rest, ns }: { rest: RestFn; ns: string }) {
  const [paths, setPaths] = useState<string[] | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);

  const loadPaths = async () => {
    try {
      const openapi = await rest(`${ns}/openapi/json`);
      setPaths(simpleGetPaths(openapi));
      setError(null);
    } catch (e) {
      setError(e);
    }
  };

  const call = async (path: string) => {
    setSelectedPath(path);
    try {
      setResult(await rest(`${ns}${path}`));
      setError(null);
    } catch (e) {
      setError(e);
      setResult(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={loadPaths}>
        Explorer l'API (/openapi/json)
      </button>
      {paths ? (
        <div className="flex flex-wrap gap-1">
          {paths.map((p) => (
            <button key={p} type="button" className={p === selectedPath ? "underline" : ""} onClick={() => call(p)}>
              {p}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <pre className="text-red-400 whitespace-pre-wrap">{String(error)}</pre> : null}
      {result ? <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  );
}

/** Tabs specific to the paragone brick. A brick with no entry here only gets lifecycle + the explorer (generic fallback) -- generalizing this mapping is explicitly out of scope until paragone itself runs end to end (Phase 5). Ordre et défaut : `public/src/shell/constants.js::ROUTES`/`DEFAULT_ROUTE` du front vanilla -- reflète le flow réel (triage d'abord), pas arbitraire. */
function ParagoneTabs({
  api,
  rest,
  ns,
  cwd,
  onProjectChanged,
  statusControl,
}: {
  api: ParagoneApi;
  rest: RestFn;
  ns: string;
  cwd?: string;
  onProjectChanged: () => void;
  statusControl: ReactNode;
}) {
  const [tab, setTab] = useState<
    "project" | "jobs" | "triage" | "inventory" | "corpus" | "stats" | "reference" | "debug"
  >("triage");
  // Renvoi "Stats → Triage filtré" (StatsView::onOpenTriage) : state React
  // ordinaire, PAS le hash -- voir shell/hash.ts pour pourquoi ce plugin ne
  // touche jamais window.location. TriageView ne lit `pendingFilters` qu'au
  // montage (useMemo([])), donc la valeur présente à l'instant où `tab`
  // bascule sur "triage" est celle qui compte.
  const [pendingFilters, setPendingFilters] = useState<Record<string, string> | undefined>(undefined);
  const openTriage = (filter: string, value: string) => {
    setPendingFilters({ [filter]: value });
    setTab("triage");
  };
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
  useEffect(() => {
    api
      .getVocabulary()
      .then((v) => setVocabulary(v as Vocabulary))
      .catch(() => setVocabulary(null));
  }, [api]);
  const tabs: { id: typeof tab; label: string }[] = [
    { id: "project", label: "Projet" },
    { id: "jobs", label: "Scan & Juge" },
    { id: "triage", label: "Triage" },
    { id: "inventory", label: "Inventaires" },
    { id: "corpus", label: "Corpus" },
    { id: "stats", label: "Statistiques" },
    { id: "reference", label: "Référentiel" },
    { id: "debug", label: "Debug" },
  ];
  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 border-b border-(--ui-stroke-secondary)">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? "underline" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {statusControl}
      </div>
      <div className={`flex-1 min-h-0 ${tab === "triage" || tab === "inventory" || tab === "project" ? "" : "overflow-auto"}`}>
        {tab === "project" ? <ProjectTab rest={rest} ns={ns} cwd={cwd} onChanged={onProjectChanged} /> : null}
        {tab === "reference" ? <ReferenceView api={api} /> : null}
        {tab === "stats" ? <StatsView api={api} onOpenTriage={openTriage} /> : null}
        {tab === "corpus" ? <CorpusView api={api} /> : null}
        {tab === "debug" ? <ApiExplorer rest={rest} ns={ns} /> : null}
        {tab === "jobs" ? <JobsView api={api} vocabulary={vocabulary} fsRest={rest} fsNs={ns} cwd={cwd} /> : null}
        {tab === "triage" ? (
          <TriageView api={api} vocabulary={vocabulary} mode={IMPACT_MODE} initialFilters={pendingFilters} />
        ) : null}
        {tab === "inventory" ? <TriageView api={api} vocabulary={vocabulary} mode={INVENTORY_MODE} /> : null}
      </div>
    </div>
  );
}

/**
 * Onglet dédié (pas un bandeau permanent au-dessus des autres onglets) pour
 * ouvrir un projet existant ou en créer un nouveau, via `FsBrowser` (filtré
 * aux dossiers seulement -- un projet n'est jamais un fichier). Ouvrir et
 * Créer sont deux gestes distincts (pas une case à cocher) : Ouvrir n'est
 * possible que sur un dossier qui a déjà un projet (`.paragone/findings.db`),
 * Créer prend un nom de nouveau dossier dans le dossier parcouru.
 */
function ProjectTab({ rest, ns, cwd, onChanged }: { rest: RestFn; ns: string; cwd?: string; onChanged: () => void }) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const openAt = async (path: string) => {
    setBusy(true);
    try {
      await rest(`${ns}/_cwd`, { method: "POST", body: { path, create: false } });
      setError(null);
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const createAt = async (path: string) => {
    setBusy(true);
    try {
      await rest(`${ns}/_cwd`, { method: "POST", body: { path, create: true } });
      setError(null);
      setNewName("");
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="flex items-center gap-2 text-(--ui-text-tertiary)">
        <span>projet actif : </span>
        <span>{cwd ?? "?"}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <FsBrowser
          rest={rest}
          ns={ns}
          initialPath={cwd}
          listClassName="flex-1 overflow-auto border border-(--ui-stroke-secondary) rounded"
          actions={(listing) => (
            <>
              <div className="flex items-center gap-2">
                <button type="button" disabled={busy || !listing.hasProject} onClick={() => openAt(listing.path)}>
                  Ouvrir ce dossier
                </button>
                <span className="text-(--ui-text-tertiary) text-xs">
                  {listing.hasProject ? "contient déjà un projet" : "pas encore de projet ici"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="nom du nouveau projet"
                  className="flex-1 rounded border border-(--ui-stroke-secondary) bg-transparent px-2 py-1"
                />
                <button
                  type="button"
                  disabled={busy || !newName}
                  onClick={() => createAt(`${listing.path.replace(/\/+$/, "")}/${newName}`)}
                >
                  Créer ici
                </button>
              </div>
            </>
          )}
        />
      </div>
      {error ? <pre className="text-red-400 whitespace-pre-wrap">{String(error)}</pre> : null}
    </div>
  );
}

/**
 * Compact lifecycle control -- a single toggle button (its label and action
 * flip with `status.healthy`) plus a green/red pastille, meant to sit at the
 * far right of a tab strip instead of its own banner row. We deliberately
 * drop the old "démarré par nous" / "pas démarré par nous" wording (kbtch_:
 * irrelevant) -- only reachability matters here.
 */
function BrickStatusControl({
  status,
  busy,
  onStart,
  onStop,
}: {
  status: Brick;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <StatusDot tone={status.healthy ? "good" : "bad"} />
      <Button
        type="button"
        size="sm"
        variant={status.healthy ? "outline" : "default"}
        disabled={busy}
        onClick={status.healthy ? onStop : onStart}
      >
        {busy ? "…" : status.healthy ? "Arrêter" : "Démarrer"}
      </Button>
    </div>
  );
}

function BrickDetail({ rest, brick }: { rest: RestFn; brick: Brick }) {
  const ns = `/${brick.id}`;
  const [status, setStatus] = useState<Brick>(brick);
  const [busy, setBusy] = useState(false);

  const refreshStatus = async () => {
    try {
      setStatus((await rest(`${ns}/_status`)) as Brick);
    } catch {
      // A failed poll already shows up as a red dot -- a toast every 4s for
      // the same condition would be noise, not a notification.
    }
  };

  useEffect(() => {
    refreshStatus();
    const id = setInterval(refreshStatus, 4000);
    return () => clearInterval(id);
  }, [brick.id]);

  const start = async () => {
    setBusy(true);
    try {
      setStatus((await rest(`${ns}/_start`, { method: "POST" })) as Brick);
    } catch (e) {
      host.notifyError(e, `Impossible de démarrer ${brick.label}`);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      setStatus((await rest(`${ns}/_stop`, { method: "POST" })) as Brick);
    } catch (e) {
      host.notifyError(e, `Impossible d'arrêter ${brick.label}`);
    } finally {
      setBusy(false);
    }
  };

  const api = useMemo(() => makeApi(fetcherFor(rest, ns)), [rest, ns]);
  const statusControl = <BrickStatusControl status={status} busy={busy} onStart={start} onStop={stop} />;

  return brick.id === "paragone" ? (
    <ParagoneTabs
      key={status.cwd}
      api={api}
      rest={rest}
      ns={ns}
      cwd={status.cwd}
      onProjectChanged={refreshStatus}
      statusControl={statusControl}
    />
  ) : (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 border-b border-(--ui-stroke-secondary) pb-2">
        <div className="font-medium">{brick.label}</div>
        {statusControl}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <ApiExplorer rest={rest} ns={ns} />
      </div>
    </div>
  );
}

function PanoptikaPage({ rest }: { rest: RestFn }) {
  const [bricks, setBricks] = useState<Brick[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const refreshBricks = async () => {
    try {
      const list = (await rest("/_bricks")) as Brick[];
      setBricks(list);
      setError(null);
      if (!selected && list.length) setSelected(list[0].id);
    } catch (e) {
      setError(e);
    }
  };

  useEffect(() => {
    refreshBricks();
    const id = setInterval(refreshBricks, 4000);
    return () => clearInterval(id);
  }, []);

  const brick = bricks && selected ? (bricks.find((b) => b.id === selected) ?? null) : null;

  return (
    <div className="paragone-skin flex h-full flex-col gap-3 p-4 text-sm">
      <style>{skinCss}</style>
      <div className="font-medium text-base">Pentest / Bug Bounty / Recherche</div>
      {error ? <pre className="text-red-400 whitespace-pre-wrap">{String(error)}</pre> : null}
      {!bricks ? (
        <div>chargement…</div>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0">
          <BrickMenu bricks={bricks} selected={selected} onSelect={setSelected} />
          <div className="flex-1 min-h-0">{brick ? <BrickDetail rest={rest} brick={brick} /> : null}</div>
        </div>
      )}
    </div>
  );
}

export default {
  id: "panoptika", // must match the plugin folder name
  name: "Panoptika",

  register(ctx: { registerMany: (items: unknown[]) => void; rest: RestFn }) {
    ctx.registerMany([
      {
        id: "page",
        area: ROUTES_AREA,
        data: { path: "/panoptika" },
        render: () => <PanoptikaPage rest={(path, opts) => ctx.rest(path, opts)} />,
      },
      {
        id: "nav",
        area: SIDEBAR_NAV_AREA,
        data: { path: "/panoptika", label: "Panoptika", codicon: "shield" },
      },
    ]);
  },
};
