/**
 * FolderBrowser.tsx — Port du `FolderBrowser` de obs
 * (`~/Projects/obs/ui/views/App.tsx`) : même markup et même CSS
 * (`.folder-browser`, `.path`, `ul.plain`, `button.dir` / `.dir.up`,
 * `.btn-primary` pour valider), même geste de navigation (un clic descend,
 * « ↑ dossier parent » remonte). Remplace l'ancien `FsBrowser` maison
 * (breadcrumbs + classes utilitaires Tailwind), qui ne ressemblait à rien
 * d'autre dans la famille.
 *
 * Deux ajouts propres à paragone, le reste est identique à obs :
 *  - `hasProject` : un dossier contenant déjà `.paragone/findings.db` est
 *    marqué, et `canChoose` permet à l'appelant de n'autoriser la validation
 *    que dans ce cas (ouvrir un projet) ou toujours (choisir une cible de
 *    scan, créer un projet) ;
 *  - `includeFiles` : Scan & Juge peut analyser un fichier isolé, pas
 *    seulement un dossier ; un clic sur un fichier le choisit directement.
 *
 * Source des données : `GET <ns>/_fs/list` côté proxy Hermes
 * (`hermes-plugin/dashboard/tool_proxy.py`) -- pas de boîte de dialogue
 * native (le SDK plugin n'en expose aucune, et ça ne marcherait pas depuis un
 * navigateur) : juste fetch + JSON, donc identique dans les deux hôtes.
 */
import { useEffect, useState } from "react";

export type RestFn = (path: string, opts?: { method?: string; body?: unknown }) => Promise<unknown>;

export type FsEntry = { name: string; path: string; isDir: boolean; hasProject: boolean };
export type FsListing = { path: string; parent: string | null; hasProject: boolean; entries: FsEntry[] };

export function FolderBrowser({
  rest,
  ns = "",
  start,
  includeFiles = false,
  onPickFile,
  onChoose,
  chooseLabel = "Choisir ce dossier",
  canChoose,
  hint,
}: {
  rest: RestFn;
  ns?: string;
  /** Dossier de départ ; absent = le dossier du projet actif, décidé côté backend. */
  start?: string;
  includeFiles?: boolean;
  onPickFile?: (path: string) => void;
  onChoose: (listing: FsListing) => void;
  chooseLabel?: string;
  /** Validation conditionnelle (ex. « seulement si ce dossier contient déjà un projet »). */
  canChoose?: (listing: FsListing) => boolean;
  /** Ligne d'aide sous le bouton, calculée sur le dossier courant. */
  hint?: (listing: FsListing) => string;
}) {
  const [listing, setListing] = useState<FsListing | null>(null);
  const [failure, setFailure] = useState("");

  const browse = (path?: string) => {
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    rest(`${ns}/_fs/list${query}`)
      .then((l) => {
        setListing(l as FsListing);
        setFailure("");
      })
      .catch((e) => setFailure(e instanceof Error ? e.message : String(e)));
  };
  useEffect(() => {
    browse(start);
    // Au montage seulement : toute navigation ultérieure passe par `browse`.
  }, [rest, ns, start]);

  const dirs = listing ? listing.entries.filter((e) => e.isDir) : [];
  const files = includeFiles && listing ? listing.entries.filter((e) => !e.isDir) : [];

  return (
    <div className="folder-browser">
      {failure ? <p className="msg bad">{failure}</p> : null}
      {listing ? (
        <>
          <div className="path">{listing.path}</div>
          <ul className="plain">
            {listing.parent ? (
              <li>
                <button type="button" className="dir up" onClick={() => browse(listing.parent as string)}>
                  ↑ dossier parent
                </button>
              </li>
            ) : null}
            {dirs.map((dir) => (
              <li key={dir.path}>
                <button type="button" className="dir" onClick={() => browse(dir.path)}>
                  {dir.name}/{dir.hasProject ? <span className="muted"> · projet</span> : null}
                </button>
              </li>
            ))}
            {files.map((file) => (
              <li key={file.path}>
                <button type="button" className="dir file" onClick={() => onPickFile?.(file.path)}>
                  {file.name}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-primary"
            disabled={canChoose ? !canChoose(listing) : false}
            onClick={() => onChoose(listing)}
          >
            {chooseLabel}
          </button>
          {hint ? <span className="muted hint"> {hint(listing)}</span> : null}
        </>
      ) : null}
    </div>
  );
}
