/**
 * FsBrowser.tsx — Navigateur de dossiers (et, en option, fichiers) partagé
 * entre l'onglet Projet (ouverture/création d'un projet) et le choix du
 * dossier/fichier à analyser dans Scan & Juge. Server-driven (breadcrumbs +
 * liste cliquable) via `GET <ns>/_fs/list` côté proxy Hermes (tool_proxy.py)
 * -- pas de boîte de dialogue native (aucune exposée par le SDK plugin
 * desktop, et ça ne marcherait pas depuis un navigateur web) : juste
 * fetch+JSON, valide identiquement dans les deux. Hermes-only pour l'instant
 * (dépend de `_fs/list`, qui n'existe pas côté paragone lui-même) mais sans
 * rien d'Electron-spécifique dans le composant -- un hôte futur qui
 * exposerait la même route pourrait le réutiliser tel quel.
 */
import { useEffect, useState, type ReactNode } from "react";

export type RestFn = (path: string, opts?: { method?: string; body?: unknown }) => Promise<unknown>;

export type FsEntry = { name: string; path: string; isDir: boolean; hasProject: boolean };
export type FsListing = { path: string; parent: string | null; hasProject: boolean; entries: FsEntry[] };

export function FsBrowser({
  rest,
  ns,
  initialPath,
  includeFiles = false,
  onPickFile,
  actions,
  listClassName = "max-h-64 overflow-auto border border-(--ui-stroke-secondary) rounded",
}: {
  rest: RestFn;
  ns: string;
  initialPath?: string;
  /** Lists files alongside directories; a file row calls `onPickFile` directly (no navigation into it). */
  includeFiles?: boolean;
  onPickFile?: (path: string) => void;
  /** Rendered below the listing, given the currently browsed directory -- the caller decides what "choosing" this directory means (open a project, create one, select it as an analyze target, ...). */
  actions?: (listing: FsListing) => ReactNode;
  listClassName?: string;
}) {
  const [listing, setListing] = useState<FsListing | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = async (path?: string) => {
    try {
      const query = path ? `?path=${encodeURIComponent(path)}` : "";
      const result = (await rest(`${ns}/_fs/list${query}`)) as FsListing;
      setListing(result);
      setError(null);
    } catch (e) {
      setError(e);
    }
  };

  useEffect(() => {
    load(initialPath);
    // Only on mount: `navigate` below drives every later load explicitly.
  }, []);

  const navigate = (path: string) => load(path);

  const crumbs = listing ? listing.path.split("/").filter(Boolean) : [];
  const dirs = listing ? listing.entries.filter((e) => e.isDir) : [];
  const files = includeFiles && listing ? listing.entries.filter((e) => !e.isDir) : [];

  if (!listing) return <div>chargement…</div>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button type="button" onClick={() => navigate("/")}>
          /
        </button>
        {crumbs.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <span>/</span>
            <button type="button" onClick={() => navigate("/" + crumbs.slice(0, i + 1).join("/"))}>
              {seg}
            </button>
          </span>
        ))}
      </div>
      <div className={listClassName}>
        {listing.parent !== null ? (
          <button
            type="button"
            className="block w-full text-left px-2 py-1"
            onClick={() => navigate(listing.parent as string)}
          >
            ..
          </button>
        ) : null}
        {dirs.map((entry) => (
          <button
            key={entry.path}
            type="button"
            className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left"
            onClick={() => navigate(entry.path)}
          >
            <span>{entry.name}/</span>
            {entry.hasProject ? <span className="text-xs opacity-70">● projet</span> : null}
          </button>
        ))}
        {files.map((entry) => (
          <button
            key={entry.path}
            type="button"
            className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left opacity-80"
            onClick={() => onPickFile?.(entry.path)}
          >
            <span>{entry.name}</span>
          </button>
        ))}
      </div>
      {actions ? actions(listing) : null}
      {error ? <pre className="text-red-400 whitespace-pre-wrap">{String(error)}</pre> : null}
    </div>
  );
}
