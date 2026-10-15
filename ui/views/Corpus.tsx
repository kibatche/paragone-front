/**
 * Corpus.tsx — Port React fidèle de `public/src/corpus/view.js` +
 * `corpus/constants.js` : fichiers scannés et matches des analyzers,
 * filtrés et paginés ; un clic sur un fichier ouvre ses matches.
 */
import { useEffect, useState } from "react";
import type { ParagoneApi } from "../api/client";
import { formatDate, shortFile } from "../format";
import { Badge, DataTable, ErrorMessage, Pager, Select } from "../components/widgets";

const FILES = "files";
const MATCHES = "matches";
const TABLE_PAGE = 100;
const FILE_STATUSES = ["ok", "not_js", "parse_error"];
const FILTER_DEBOUNCE_MS = 200;

type Tab = typeof FILES | typeof MATCHES;

type FileRow = {
  id: number;
  path: string;
  status: string;
  matches: number;
  leads: number;
  scanned_at: number;
  error?: string | null;
};
type MatchRow = {
  analyzer: string;
  file: string;
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
  leads: number;
  value: string;
};

const monoClip = (text: string, title?: string) => (
  <span className="mono clip" title={title ?? text}>
    {text}
  </span>
);

function filesColumns() {
  return [
    { title: "fichier", cell: (f: FileRow) => monoClip(f.path) },
    { title: "statut", cell: (f: FileRow) => <Badge value={f.status} /> },
    { title: "matches", cell: (f: FileRow) => String(f.matches) },
    { title: "leads", cell: (f: FileRow) => String(f.leads) },
    { title: "scanné", cell: (f: FileRow) => formatDate(f.scanned_at) },
    { title: "erreur", cell: (f: FileRow) => f.error ?? "" },
  ];
}

function matchesColumns() {
  return [
    { title: "analyzer", cell: (m: MatchRow) => m.analyzer },
    { title: "fichier", cell: (m: MatchRow) => monoClip(shortFile(m.file), m.file) },
    { title: "position", cell: (m: MatchRow) => `${m.start_line}:${m.start_column} → ${m.end_line}:${m.end_column}` },
    { title: "leads", cell: (m: MatchRow) => String(m.leads) },
    { title: "match", cell: (m: MatchRow) => monoClip(m.value) },
  ];
}

/** Debounce : même délai que la version vanilla (`FILTER_DEBOUNCE_MS`). */
function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delayMs: number) {
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    setTimer(setTimeout(() => fn(...args), delayMs));
  };
}

export function CorpusView({ api }: { api: ParagoneApi }) {
  const [tab, setTab] = useState<Tab>(FILES);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [fileId, setFileId] = useState("");
  const [analyzer, setAnalyzer] = useState("");

  const [files, setFiles] = useState<{ rows: FileRow[]; total: number } | null>(null);
  const [matches, setMatches] = useState<{ rows: MatchRow[]; total: number } | null>(null);
  const [error, setError] = useState<unknown>(null);

  const filters = tab === FILES ? { status, q } : { file_id: fileId, analyzer };

  useEffect(() => {
    let cancelled = false;
    const page = { ...filters, limit: TABLE_PAGE, offset };
    const isFiles = tab === FILES;
    Promise.all([
      isFiles ? api.listFiles(page) : api.listMatches(page),
      isFiles ? api.countFiles(filters) : api.countMatches(filters),
    ])
      .then(([rows, count]) => {
        if (cancelled) return;
        const total = (count as { total: number }).total;
        if (isFiles) setFiles({ rows: rows as FileRow[], total });
        else setMatches({ rows: rows as MatchRow[], total });
        setError(null);
      })
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [api, tab, offset, status, q, fileId, analyzer]);

  const debouncedSetQ = useDebouncedCallback((v: string) => {
    setOffset(0);
    setQ(v);
  }, FILTER_DEBOUNCE_MS);
  const debouncedSetAnalyzer = useDebouncedCallback((v: string) => {
    setOffset(0);
    setAnalyzer(v);
  }, FILTER_DEBOUNCE_MS);
  const debouncedSetFileId = useDebouncedCallback((v: string) => {
    setOffset(0);
    setFileId(v);
  }, FILTER_DEBOUNCE_MS);

  const switchTab = (next: Tab, patch: Partial<{ fileId: string }> = {}) => {
    setTab(next);
    setOffset(0);
    if (patch.fileId !== undefined) setFileId(patch.fileId);
  };

  const data = tab === FILES ? files : matches;

  return (
    <div className="page">
      <h2>Corpus</h2>
      <div className="tabs">
        <button type="button" className={tab === FILES ? "tab on" : "tab"} onClick={() => switchTab(FILES)}>
          Fichiers
        </button>
        <button type="button" className={tab === MATCHES ? "tab on" : "tab"} onClick={() => switchTab(MATCHES)}>
          Matches
        </button>
      </div>
      <div className="controls">
        {tab === FILES ? (
          <>
            <input
              type="search"
              placeholder="chemin contient…"
              defaultValue={q}
              onChange={(e) => debouncedSetQ(e.target.value.trim())}
            />
            <Select
              placeholder="statut"
              options={FILE_STATUSES.map((s) => ({ value: s, label: s }))}
              value={status}
              onChange={(v) => {
                setOffset(0);
                setStatus(v);
              }}
            />
          </>
        ) : (
          <>
            <input
              type="search"
              placeholder="analyzer (nom exact)"
              defaultValue={analyzer}
              onChange={(e) => debouncedSetAnalyzer(e.target.value.trim())}
            />
            <input
              type="number"
              min={1}
              placeholder="id du fichier"
              defaultValue={fileId}
              onChange={(e) => debouncedSetFileId(e.target.value.trim())}
            />
          </>
        )}
      </div>
      <div className="results">
        {error ? (
          <ErrorMessage error={error} />
        ) : !data ? (
          <div>chargement…</div>
        ) : (
          <>
            <Pager offset={offset} limit={TABLE_PAGE} total={data.total} shown={data.rows.length} onMove={setOffset} />
            {tab === FILES ? (
              <DataTable<FileRow>
                columns={filesColumns()}
                rows={files!.rows}
                onRow={(f) => switchTab(MATCHES, { fileId: String(f.id) })}
              />
            ) : (
              <DataTable<MatchRow> columns={matchesColumns()} rows={matches!.rows} />
            )}
            <Pager offset={offset} limit={TABLE_PAGE} total={data.total} shown={data.rows.length} onMove={setOffset} />
          </>
        )}
      </div>
    </div>
  );
}
