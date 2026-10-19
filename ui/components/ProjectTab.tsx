/**
 * ProjectTab.tsx — Onglet « Projet » : ouvrir un projet existant ou en créer
 * un nouveau, chacun dans sa propre boîte de dialogue (`Modal` +
 * `FolderBrowser`, repris de obs). Vit ici, hors de `hermes/plugin.tsx`, pour
 * ne dépendre que de React et du `rest` injecté -- donc testable et
 * réutilisable par tout hôte exposant `_fs/list`, comme les autres vues.
 */
import { useState } from "react";
import { FolderBrowser, type RestFn } from "./FolderBrowser";
import { Modal } from "./Modal";

/**
 * Boîte « Ouvrir un projet » -- navigateur de dossiers, validation réservée à
 * un dossier qui contient déjà un projet (`.paragone/findings.db`).
 */
export function OpenProjectDialog({
  rest,
  start,
  busy,
  onClose,
  onChoose,
}: {
  rest: RestFn;
  start?: string;
  busy: boolean;
  onClose: () => void;
  onChoose: (path: string) => void;
}) {
  return (
    <Modal title="Ouvrir un projet" subtitle="un dossier contenant déjà .paragone/findings.db" onClose={onClose}>
      <FolderBrowser
        rest={rest}
        start={start}
        onChoose={(listing) => onChoose(listing.path)}
        chooseLabel="Ouvrir ce dossier"
        canChoose={(listing) => listing.hasProject && !busy}
        hint={(listing) => (listing.hasProject ? "contient déjà un projet" : "pas de projet ici")}
      />
      <div className="actions">
        <button type="button" onClick={onClose}>
          Annuler
        </button>
      </div>
    </Modal>
  );
}

/**
 * Boîte « Nouveau projet » -- reprise de `CreateDialog` de obs : un champ nom,
 * un emplacement affiché en chemin mono avec un bouton « Changer… » qui
 * déplie le navigateur, un récapitulatif du chemin final, et les deux actions
 * Annuler / Créer en bas à droite.
 */
export function CreateProjectDialog({
  rest,
  start,
  busy,
  onClose,
  onCreate,
}: {
  rest: RestFn;
  start?: string;
  busy: boolean;
  onClose: () => void;
  onCreate: (path: string) => void;
}) {
  const [name, setName] = useState("");
  const [parent, setParent] = useState(start ?? "");
  const [browsing, setBrowsing] = useState(!start);
  const finalPath = `${(parent || "").replace(/\/+$/, "")}/${name.trim() || "…"}`;

  return (
    <Modal title="Nouveau projet" subtitle="un dossier neuf, créé puis ouvert" onClose={onClose}>
      <div className="field">
        <span className="field-label">Nom du dossier</span>
        <div className="inline">
          <input
            type="text"
            spellCheck={false}
            value={name}
            placeholder="nom du nouveau projet"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <span className="field-label">Emplacement</span>
        <div className="inline">
          <code className="mono-path">{parent || "—"}/</code>
          <button type="button" onClick={() => setBrowsing((v) => !v)}>
            Changer…
          </button>
        </div>
        {browsing ? (
          <FolderBrowser
            rest={rest}
            start={parent || undefined}
            onChoose={(listing) => {
              setParent(listing.path);
              setBrowsing(false);
            }}
          />
        ) : null}
      </div>
      <div className="field">
        <span className="field-label">Sera créé</span>
        <code className="mono-path strong">{finalPath}/</code>
      </div>
      <div className="actions">
        <button type="button" onClick={onClose}>
          Annuler
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !name.trim() || !parent}
          onClick={() => onCreate(finalPath)}
        >
          Créer
        </button>
      </div>
    </Modal>
  );
}

/**
 * Onglet dédié (pas un bandeau permanent au-dessus des autres onglets) pour
 * ouvrir un projet existant ou en créer un nouveau. Ouvrir et Créer sont deux
 * gestes distincts, chacun dans sa propre boîte de dialogue -- même code et
 * même style que obs (`Modal` + `FolderBrowser`), au lieu d'un navigateur
 * déplié en permanence dans la page.
 */
export function ProjectTab({ rest, cwd, onChanged }: { rest: RestFn; cwd?: string; onChanged: () => void }) {
  const [dialog, setDialog] = useState<"open" | "create" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const setCwd = async (path: string, create: boolean) => {
    setBusy(true);
    try {
      await rest(`/_cwd`, { method: "POST", body: { path, create } });
      setError(null);
      setDialog(null);
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="field">
        <span className="field-label">Projet actif</span>
        <code className="mono-path strong">{cwd ?? "?"}</code>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => setDialog("open")}>
          Ouvrir un projet…
        </button>
        <button type="button" disabled={busy} onClick={() => setDialog("create")}>
          Nouveau projet…
        </button>
      </div>
      {dialog === "open" ? (
        <OpenProjectDialog
          rest={rest}
          start={cwd}
          busy={busy}
          onClose={() => setDialog(null)}
          onChoose={(path) => setCwd(path, false)}
        />
      ) : null}
      {dialog === "create" ? (
        <CreateProjectDialog
          rest={rest}
          start={cwd}
          busy={busy}
          onClose={() => setDialog(null)}
          onCreate={(path) => setCwd(path, true)}
        />
      ) : null}
      {error ? <p className="msg bad">{String(error)}</p> : null}
    </div>
  );
}
