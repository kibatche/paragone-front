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
import { ROUTES_AREA, SIDEBAR_NAV_AREA } from "@hermes/plugin-sdk";
import { useEffect, useMemo, useState } from "react";
import { makeApi, type Fetcher, type ParagoneApi } from "../api/client";
import { buildQuery } from "../api/query";
import { skinCss } from "./skin.generated";
import { ReferenceView } from "../views/Reference";
import { StatsView } from "../views/Stats";
import { CorpusView } from "../views/Corpus";
import { TriageView } from "../views/Triage";
import { IMPACT_MODE, INVENTORY_MODE } from "../triage/constants";
import type { Vocabulary } from "../triage/types";

type RestFn = (path: string, opts?: { method?: string; body?: unknown }) => Promise<unknown>;

type Brick = { id: string; label: string; running: boolean; healthy: boolean; base_url: string };

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
function ParagoneTabs({ api, rest, ns }: { api: ParagoneApi; rest: RestFn; ns: string }) {
  const [tab, setTab] = useState<"triage" | "inventory" | "corpus" | "stats" | "reference" | "debug">("triage");
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
  useEffect(() => {
    api
      .getVocabulary()
      .then((v) => setVocabulary(v as Vocabulary))
      .catch(() => setVocabulary(null));
  }, [api]);
  const tabs: { id: typeof tab; label: string }[] = [
    { id: "triage", label: "Triage" },
    { id: "inventory", label: "Inventaires" },
    { id: "corpus", label: "Corpus" },
    { id: "stats", label: "Statistiques" },
    { id: "reference", label: "Référentiel" },
    { id: "debug", label: "Debug" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 border-b border-(--ui-stroke-secondary)">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? "underline" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "reference" ? <ReferenceView api={api} /> : null}
      {tab === "stats" ? <StatsView api={api} /> : null}
      {tab === "corpus" ? <CorpusView api={api} /> : null}
      {tab === "triage" ? <TriageView api={api} vocabulary={vocabulary} mode={IMPACT_MODE} /> : null}
      {tab === "inventory" ? <TriageView api={api} vocabulary={vocabulary} mode={INVENTORY_MODE} /> : null}
      {tab === "debug" ? <ApiExplorer rest={rest} ns={ns} /> : null}
    </div>
  );
}

function BrickDetail({ rest, brick }: { rest: RestFn; brick: Brick }) {
  const ns = `/${brick.id}`;
  const [status, setStatus] = useState<Brick>(brick);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refreshStatus = async () => {
    try {
      setStatus((await rest(`${ns}/_status`)) as Brick);
      setError(null);
    } catch (e) {
      setError(e);
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
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      setStatus((await rest(`${ns}/_stop`, { method: "POST" })) as Brick);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const api = useMemo(() => makeApi(fetcherFor(rest, ns)), [rest, ns]);

  return (
    <div className="flex flex-col gap-3">
      <div className="font-medium">{brick.label}</div>
      <div className="flex items-center gap-2 text-(--ui-text-tertiary)">
        <span>statut : </span>
        <span>
          {status.running ? "démarré par nous" : "pas démarré par nous"} /{" "}
          {status.healthy ? "joignable" : "pas joignable"} ({status.base_url})
        </span>
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={start}>
          Démarrer
        </button>
        <button type="button" disabled={busy} onClick={stop}>
          Arrêter
        </button>
      </div>
      {error ? <pre className="text-red-400 whitespace-pre-wrap">{String(error)}</pre> : null}
      {brick.id === "paragone" ? <ParagoneTabs api={api} rest={rest} ns={ns} /> : <ApiExplorer rest={rest} ns={ns} />}
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
          <div className="flex-1 overflow-auto">{brick ? <BrickDetail rest={rest} brick={brick} /> : null}</div>
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
