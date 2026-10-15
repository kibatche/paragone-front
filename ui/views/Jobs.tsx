/**
 * Jobs.tsx — Port React fidèle de `public/src/jobs/view.js` +
 * `jobs/constants.js` : configuration en mémoire (dossier à analyser,
 * classes, lot), lancement du scan et du juge, suivi du travail en cours et
 * du dernier terminé (poll tant qu'un travail tourne). Même sémantique et
 * mêmes noms de classes CSS que la version vanilla.
 */
import { useEffect, useRef, useState } from "react";
import type { ParagoneApi } from "../api/client";
import { formatDate, formatDuration } from "../format";
import { Badge, ClsTag, ErrorMessage, KvGrid, Message, Section } from "../components/widgets";
import { FsBrowser, type RestFn } from "../components/FsBrowser";
import type { Vocabulary } from "../triage/types";

const JOBS_POLL_MS = 1500;
const JUDGE_CONFIRMATION =
  "Le juge dépense des tokens sur tous les leads sans jugement des classes configurées. Lancer ?";

type Job = {
  id: string;
  kind: string;
  state: string;
  started_at: number;
  ended_at: number | null;
  classes: string[];
  progress: { done: number; total: number } | null;
  scan: { files: number; scanned: number; unchanged: number; notJs: number; parseErrors: number; addedLeads: number } | null;
  usage: Record<string, { input: number; cacheRead: number; cacheWrite: number; output: number; total: number; cost: number }> | null;
  error: string | null;
};

type Config = { analyze?: string; classes: string[]; batch: number };

function describeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Grille des champs d'un objet de bilan (progression, scan, usage), sans les valeurs vides. */
function ObjectGrid({ object }: { object: Record<string, unknown> | null }) {
  if (!object) return null;
  return <KvGrid pairs={Object.entries(object).map(([key, value]) => [key, describeValue(value)])} />;
}

function JobCard({ title, job }: { title: string; job: Job | null }) {
  if (!job)
    return (
      <Section title={title}>
        <div className="card muted">Aucun travail.</div>
      </Section>
    );
  const state = job.state === "error" ? "REJECT" : job.state === "running" ? "MEDIUM" : "CONFIRMED";
  return (
    <Section title={title} aside={job.id}>
      <div className="card">
        <KvGrid
          pairs={[
            ["nature", job.kind],
            ["état", <Badge value={state} text={job.state} />],
            ["début", formatDate(job.started_at)],
            ["durée", formatDuration(job.started_at, job.ended_at)],
            ["classes", <span>{job.classes.map((c) => <ClsTag key={c} cls={c} />)}</span>],
            ["erreur", job.error ? <span className="bad">{job.error}</span> : null],
          ]}
        />
        {job.progress ? <h4>avancement</h4> : null}
        <ObjectGrid object={job.progress} />
        {job.scan ? <h4>bilan du scan</h4> : null}
        <ObjectGrid object={job.scan} />
        {job.usage ? <h4>usage du juge</h4> : null}
        <ObjectGrid object={job.usage} />
      </div>
    </Section>
  );
}

function ConfigForm({
  config,
  vocabulary,
  onSave,
  fsRest,
  fsNs,
  cwd,
}: {
  config: Config;
  vocabulary: Vocabulary;
  onSave: (config: Config) => Promise<void>;
  /** Navigateur de dossiers/fichiers pour "Dossier à analyser" -- Hermes
   * seulement (dépend du proxy `_fs/list`) ; absent en standalone, où le
   * champ reste un texte libre, comme avant. */
  fsRest?: RestFn;
  fsNs?: string;
  cwd?: string;
}) {
  const [analyze, setAnalyze] = useState(config.analyze ?? "");
  const [batch, setBatch] = useState(config.batch);
  const [browsing, setBrowsing] = useState(false);
  const chosen = new Set(config.classes.map((c) => c.toUpperCase()));
  const [checked, setChecked] = useState<Set<string>>(
    new Set(vocabulary.impactClasses.filter((cls) => chosen.has(cls) || chosen.has("ALL"))),
  );
  const [status, setStatus] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);

  const toggle = (cls: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  };

  const pick = (path: string) => {
    setAnalyze(path);
    setBrowsing(false);
  };

  const save = async () => {
    try {
      await onSave({ analyze: analyze.trim(), classes: [...checked], batch });
      setStatus({ kind: "ok", text: `✓ enregistré : ${analyze.trim()} · ${[...checked].join(", ")} · lot ${batch}` });
    } catch (error) {
      setStatus(null);
      setError(error);
    }
  };

  const [error, setError] = useState<unknown>(null);

  return (
    <div className="card form">
      <label>
        Dossier à analyser
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={analyze}
            onChange={(e) => setAnalyze(e.target.value)}
            placeholder="chemin absolu du dossier ou du fichier"
            className="flex-1"
          />
          {fsRest && fsNs ? (
            <button type="button" onClick={() => setBrowsing((b) => !b)}>
              {browsing ? "Fermer" : "Parcourir"}
            </button>
          ) : null}
        </div>
      </label>
      {browsing && fsRest && fsNs ? (
        <FsBrowser
          rest={fsRest}
          ns={fsNs}
          // Préselection sur le dossier du projet actif : le workflow de
          // kbtch_ implique souvent un symlink vers jxscout au sein de
          // l'arbo de travail, donc le point de départ le plus utile est le
          // projet lui-même, pas la racine du système ou le home.
          initialPath={analyze || cwd}
          includeFiles
          onPickFile={pick}
          actions={(listing) => (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => pick(listing.path)}>
                Choisir ce dossier
              </button>
            </div>
          )}
        />
      ) : null}
      <div className="classes">
        {vocabulary.impactClasses.map((cls) => (
          <label key={cls} className="inline">
            <input type="checkbox" checked={checked.has(cls)} onChange={() => toggle(cls)} />
            <ClsTag cls={cls} />
          </label>
        ))}
      </div>
      <label>
        Leads envoyés en parallèle au juge
        <input type="number" min={1} value={batch} onChange={(e) => setBatch(Number(e.target.value))} />
      </label>
      <button type="button" className="decide keep" onClick={save}>
        Enregistrer la configuration
      </button>
      <div className="status">
        {error ? <ErrorMessage error={error} /> : status ? <Message kind={status.kind} text={status.text} /> : null}
      </div>
    </div>
  );
}

export function JobsView({
  api,
  vocabulary,
  fsRest,
  fsNs,
  cwd,
}: {
  api: ParagoneApi;
  vocabulary: Vocabulary | null;
  fsRest?: RestFn;
  fsNs?: string;
  cwd?: string;
}) {
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState<unknown>(null);
  const [current, setCurrent] = useState<Job | null>(null);
  const [last, setLast] = useState<Job | null>(null);
  const [jobsError, setJobsError] = useState<unknown>(null);
  const [actionStatus, setActionStatus] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const timer = useRef(0);
  const destroyed = useRef(false);

  const pollJobs = async () => {
    clearTimeout(timer.current);
    try {
      const { current: c, last: l } = (await api.getJobs()) as { current: Job | null; last: Job | null };
      setCurrent(c);
      setLast(l);
      setJobsError(null);
      if (c && !destroyed.current) timer.current = window.setTimeout(pollJobs, JOBS_POLL_MS);
    } catch (error) {
      setJobsError(error);
    }
  };

  useEffect(() => {
    destroyed.current = false;
    api
      .getConfig()
      .then((c) => setConfig(c as Config))
      .catch((error) => setConfigError(error));
    pollJobs();
    return () => {
      destroyed.current = true;
      clearTimeout(timer.current);
    };
    // Only on mount: `pollJobs` re-schedules itself through the ref-held timer.
  }, [api]);

  const save = async (next: Config) => {
    const saved = (await api.putConfig(next)) as Config;
    setConfig(saved);
  };

  const launch = async (start: () => Promise<unknown>) => {
    try {
      const job = (await start()) as Job;
      setActionStatus({ kind: "ok", text: `✓ ${job.kind} lancé (${job.id})` });
    } catch (error) {
      setActionStatus(null);
      setJobsError(error);
    }
    await pollJobs();
  };

  return (
    <div className="page">
      <h2>Scan &amp; Juge</h2>
      <Section title="Configuration" aside="en mémoire, le temps du service">
        {configError ? (
          <ErrorMessage error={configError} />
        ) : !config || !vocabulary ? (
          <div>chargement…</div>
        ) : (
          <ConfigForm config={config} vocabulary={vocabulary} onSave={save} fsRest={fsRest} fsNs={fsNs} cwd={cwd} />
        )}
      </Section>
      <Section title="Lancer" aside="un seul travail à la fois">
        <div className="card">
          <div className="tools">
            <button type="button" className="decide other" onClick={() => launch(api.startScan)}>
              Lancer le scan
            </button>
            <button
              type="button"
              className="decide escalate"
              onClick={() => confirm(JUDGE_CONFIRMATION) && launch(api.startJudge)}
            >
              Lancer le juge
            </button>
            <button type="button" onClick={pollJobs}>
              Actualiser
            </button>
          </div>
          <div className="status">
            {actionStatus ? <Message kind={actionStatus.kind} text={actionStatus.text} /> : null}
          </div>
        </div>
      </Section>
      {jobsError ? <ErrorMessage error={jobsError} /> : null}
      <JobCard title="Travail en cours" job={current} />
      <JobCard title="Dernier travail terminé" job={last} />
    </div>
  );
}
