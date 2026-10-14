/**
 * triage/Dossier.tsx — Port React fidèle de `public/src/triage/dossier.js` :
 * le lead ouvert -- en-tête et barre de tri, verdict du juge, sink,
 * origines de la valeur, doublons, cadre de jugement, code source, matière
 * brute. Rend ce que `useTriage` détient.
 */
import { useEffect, useState } from "react";
import { JUDGE_SCORES, distribution, optionsText, percent, where } from "../format";
import {
  Badge,
  ClsTag,
  CodeBlock,
  ErrorMessage,
  FoldedSection,
  Holes,
  KvGrid,
  Message,
  Section,
} from "../components/widgets";
import type { Mode } from "./constants";
import { SLOT_LABELS, SOURCE_KIND, UNJUDGED } from "./constants";
import { codeSteps, isSanitized, originLines, sanitizerLabel } from "./codeSteps";
import { CodeView, type CodeViewHandle } from "./CodeView";
import type { TriageApi } from "./useTriage";
import type { ClassFrame, DossierData, Duplicate, Finding, Judgement, Lead } from "./types";

type ApiError = { detail?: string } | Error;

const humanBadge = (score: string | null | undefined, labels: Record<string, string>) =>
  score ? <Badge value={score} text={labels[score] ?? score} /> : null;

function judgementsOf(lead: Lead): Judgement[] {
  return lead.classes.map((cls) => lead.judgements.find((j) => j.class === cls) ?? { class: cls, score: UNJUDGED });
}

function DistributionBar({ probabilities }: { probabilities: Record<string, number> | undefined }) {
  const parts = distribution(probabilities ?? {});
  if (!parts.length) return null;
  return (
    <div>
      <div className="dist">
        {parts.map(({ score, p }) => (
          <span key={score} className={score} title={score} style={{ width: `${p * 100}%` }} />
        ))}
      </div>
      <div className="dist-legend">
        {parts.map(({ score, p }) => (
          <span key={score}>
            {score} {percent(p)}
          </span>
        ))}
      </div>
    </div>
  );
}

function JudgeCard({ judgement, classFrame }: { judgement: Judgement; classFrame: ClassFrame | undefined }) {
  if (judgement.score === UNJUDGED) {
    return (
      <div className="card">
        <div className="jev-head">
          <ClsTag cls={judgement.class} />
          <Badge value={null} />
        </div>
        <div className="muted">Pas encore jugé pour cette classe.</div>
      </div>
    );
  }
  const reason = judgement.reject_reason;
  return (
    <div className="card">
      <div className="jev-head">
        <ClsTag cls={judgement.class} />
        <span className={`jev-score badge ${judgement.score}`}>{judgement.score}</span>
        <span className="muted">confiance {percent(judgement.confidence ?? 0)}</span>
        <span className="faint">{judgement.model}</span>
      </div>
      <DistributionBar probabilities={judgement.probabilities} />
      {classFrame?.scores?.[judgement.score] ? <div className="jev-meaning">{classFrame.scores[judgement.score]}</div> : null}
      {reason ? (
        <div className="jev-reason">
          <b>Motif de rejet : {reason}</b>
          {classFrame?.reasons?.[reason] ? ` — ${classFrame.reasons[reason]}` : ""}
        </div>
      ) : null}
      {judgement.note ? <div className="prose">{judgement.note}</div> : null}
    </div>
  );
}

function RenderJudge({ lead, dossier, mode }: { lead: Lead; dossier: DossierData | null; mode: Mode }) {
  if (!mode.isJudged) return null;
  const cards = judgementsOf(lead).map((j) => (
    <JudgeCard key={j.class} judgement={j} classFrame={dossier?.classes.find((c) => c.cls === j.class)} />
  ));
  return (
    <Section title="Verdict du juge" aside="signal de triage, pas une preuve">
      <div className="grid-2">{cards}</div>
    </Section>
  );
}

function RenderSink({ item, dossier, mode }: { item: Lead; dossier: DossierData | null; mode: Mode }) {
  const taint = item.lead.taint;
  const slot = item.lead.slot?.kind ? SLOT_LABELS[item.lead.slot.kind]?.(item.lead.slot) : undefined;
  const request = item.lead.request;
  return (
    <Section title={mode.sinkTitle} aside={null}>
      <div className="card">
        <KvGrid
          pairs={[
            ["motif", item.pattern ? <span className="pattern" key="p"><Holes text={item.pattern} /></span> : null],
            ["reconstruit", item.reconstructed ? <code key="r">{item.reconstructed}</code> : null],
            ["emplacement", slot ?? null],
            ["méthode", request?.method ?? null],
            ["options", optionsText(request?.options) || null],
            [
              "verdict du taint",
              taint ? (
                <span key="v">
                  <Badge value={taint.verdict ?? null} />
                  {dossier?.verdictLegend ? <span className="muted"> {dossier.verdictLegend}</span> : null}
                </span>
              ) : mode.isJudged ? (
                <span className="muted" key="v">
                  pas de taint
                </span>
              ) : null,
            ],
            ["fichier", <code key="f">{`${item.file}:${item.line}:${item.column}`}</code>],
          ]}
        />
      </div>
      <CodeBlock code={item.match_text} />
    </Section>
  );
}

function OriginNode({ finding, dossier, onStep }: { finding: Finding; dossier: DossierData | null; onStep: () => void }) {
  const isSource = finding.kind === SOURCE_KIND && finding.knownSource;
  const classes = ["origin"];
  if (isSource) classes.push("source");
  else if (finding.kind !== SOURCE_KIND) classes.push("stop");
  if (isSanitized(finding)) classes.push("sanitized");
  if (finding.derivedFrom !== undefined) classes.push("derived");
  const line = finding.loc?.start?.line;
  const stopLegend = dossier?.endKindLegend?.[finding.kind];
  return (
    <li className={classes.join(" ")}>
      <div className="origin-head">
        <span className="rank">{finding.id}.</span>
        {isSource ? <span className="src">{finding.knownSource}</span> : null}
        {isSanitized(finding) ? (
          <span className="san" title="la valeur traverse cet appel : un désinfectant, pas forcément adapté au sink">
            {sanitizerLabel(finding)}
          </span>
        ) : null}
        {finding.derivedFrom !== undefined ? <span className="faint">dérivée de n°{finding.derivedFrom}</span> : null}
        {line ? (
          <button type="button" className="linelink" title="voir dans le code" onClick={onStep}>
            ligne {line}
          </button>
        ) : null}
      </div>
      <div className="origin-text">{finding.text ?? ""}</div>
      {finding.sourceString ? <div className="origin-code">{finding.sourceString}</div> : null}
      {finding.path?.length ? (
        <div className="faint path">{finding.path.map((step) => step.label ?? step.role).join(" ← ")}</div>
      ) : null}
      {finding.kind !== SOURCE_KIND ? (
        <div className="origin-stop">
          <b>Arrêt : {finding.kind}</b>
          {stopLegend ? ` — ${stopLegend}` : ""}
          {finding.endReason ? ` (${finding.endReason})` : ""}
        </div>
      ) : null}
    </li>
  );
}

function omittedText(omitted: Record<string, number> | undefined): string {
  return Object.entries(omitted ?? {})
    .map(([reason, count]) => `${count} × ${reason}`)
    .join(" · ");
}

function RenderOrigins({
  item,
  dossier,
  onStep,
  activeStep,
  showAll,
  onToggleAll,
}: {
  item: Lead;
  dossier: DossierData | null;
  onStep: (index: number) => void;
  activeStep: number;
  showAll: boolean;
  onToggleAll: () => void;
}) {
  const taint = item.lead.taint;
  if (!taint) return null;
  if (!taint.findings.length) {
    return (
      <Section title="D'où vient la valeur" aside={null}>
        <div className="card muted">Aucune origine retenue par le résolveur.</div>
      </Section>
    );
  }
  const omitted = omittedText(taint.omitted);
  const toggle = (
    <button type="button" className="chain-toggle" onClick={onToggleAll}>
      {showAll ? "◀ un seul nœud" : "voir toute la chaîne →"}
    </button>
  );
  // activeStep suit la numérotation de CodeView (0 = sink, 1..n = origines) -- le nœud
  // "courant" est donc activeStep-1 dans la liste des origines ; par défaut (sink, ou pas
  // encore de pas franchi) on retombe sur le premier nœud teinté, pas sur rien.
  const index = Math.min(Math.max(activeStep - 1, 0), taint.findings.length - 1);
  return (
    <Section title="D'où vient la valeur" aside={toggle}>
      {showAll ? (
        <ol className="chain">
          {taint.findings.map((f, i) => (
            <OriginNode key={f.id} finding={f} dossier={dossier} onStep={() => onStep(i + 1)} />
          ))}
        </ol>
      ) : (
        <ol className="chain">
          <OriginNode finding={taint.findings[index]} dossier={dossier} onStep={() => onStep(index + 1)} />
        </ol>
      )}
      {omitted ? <div className="faint omitted">Écartés : {omitted}</div> : null}
    </Section>
  );
}

function RenderDuplicates({ duplicates, onOpen }: { duplicates: Duplicate[]; onOpen: (id: number) => void }) {
  if (!duplicates.length) return null;
  return (
    <FoldedSection title="Doublons" aside={`${duplicates.length} lead(s) identique(s)`}>
      <div className="dups">
        {duplicates.map((row) => (
          <button key={row.id} type="button" className="dup" onClick={() => onOpen(row.id)}>
            <span className="id">#{row.id}</span>
            <span className="where">{where(row.file, row.line)}</span>
          </button>
        ))}
      </div>
    </FoldedSection>
  );
}

function RenderFrame({ item, dossier }: { item: Lead; dossier: DossierData | null }) {
  if (!dossier?.classes.length) return null;
  const best = (cls: string) => item.judgements.find((j) => j.class === cls)?.score;
  return (
    <Section title="Cadre de jugement" aside="ce que le juge a reçu comme consigne">
      {dossier.classes.map((frame) => (
        <div className="frame" key={frame.cls}>
          <div className="label">
            {dossier.analyzerName} · <ClsTag cls={frame.cls} />
          </div>
          {frame.guidance ? (
            <div className="prose">
              {String(frame.guidance)
                .split(/\n{2,}/)
                .map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
            </div>
          ) : null}
          <div className="scale">
            {JUDGE_SCORES.map((score) => (
              <div key={score} className={`scale-row${best(frame.cls) === score ? " current" : ""}`}>
                <Badge value={score} />
                <span>{frame.scores?.[score] ?? ""}</span>
              </div>
            ))}
          </div>
          <details>
            <summary>définition de la classe</summary>
            <div className="prose">
              {String(frame.definition)
                .split(/\n{2,}/)
                .map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
            </div>
          </details>
        </div>
      ))}
      {dossier.references.length ? (
        <ul className="refs">
          {dossier.references.map((ref) => (
            <li key={ref.url}>
              <a href={ref.url} target="_blank" rel="noreferrer noopener">
                {ref.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

function RenderRaw({ item, dossier }: { item: Lead; dossier: DossierData | null }) {
  return (
    <Section title="Matière brute" aside={null}>
      {(dossier?.classes ?? []).map((frame) => (
        <details key={frame.cls}>
          <summary>texte envoyé au juge — {frame.cls}</summary>
          <pre className="raw">{frame.caseText}</pre>
        </details>
      ))}
      <details>
        <summary>lead (JSON)</summary>
        <pre className="raw">{JSON.stringify(item.lead, null, 2)}</pre>
      </details>
    </Section>
  );
}

export function Dossier({
  triage,
  codeHandleRef,
  noteRef,
}: {
  triage: TriageApi;
  codeHandleRef: React.MutableRefObject<CodeViewHandle | null>;
  noteRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const { lead, dossier, duplicates, source, sourceError, mode } = triage.state;
  const [status, setStatus] = useState<unknown>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [showAllOrigins, setShowAllOrigins] = useState(false);

  // Nouveau lead ouvert : repartir du nœud par défaut (le premier teinté), pas garder
  // l'index ou le dépliage du lead précédent.
  useEffect(() => {
    setActiveStep(0);
    setShowAllOrigins(false);
  }, [lead?.id]);

  if (!lead) return null;

  const run = (action: () => Promise<unknown>) => action().catch((error) => setStatus(error));

  const decide = (score: string) => run(() => triage.decide(score, noteRef.current?.value.trim() ?? ""));

  const buttons = mode.decisions.map(({ score, key, label, icon, css }) => (
    <button key={score} className={`decide ${css}`} onClick={() => decide(score)}>
      {icon} {label}
      <kbd>{key}</kbd>
    </button>
  ));
  const others = mode.otherScores.map((score) => (
    <button key={score} className={`decide other ${score}`} onClick={() => decide(score)}>
      {mode.labels[score]}
    </button>
  ));

  const reveal = (index: number) => codeHandleRef.current?.showStep(index);
  const lines = lead.lead?.taint?.findings ? originLines(lead.lead.taint.findings) : { origin: new Set<number>(), sanitized: new Set<number>() };
  const steps = codeSteps(lead);

  return (
    <>
      <div className="d-head">
        <div className="d-title">
          <span className="id">#{lead.id}</span>
          <span className="sink">{lead.match_text}</span>
        </div>
        <div className="d-tags">
          {lead.classes.map((c) => (
            <ClsTag key={c} cls={c} />
          ))}
          <span>{lead.analyzer}</span>
          <span className="sep">·</span>
          <span className="mono">{where(lead.file, lead.line)}</span>
          {humanBadge(lead.human_score, mode.labels)}
        </div>
        <div className="triage-bar">
          {buttons}
          {others}
        </div>
        <textarea ref={noteRef} className="note" placeholder="commentaire (touche n)" rows={2} defaultValue={lead.human_note ?? ""} />
        <div className="tools">
          <button type="button" disabled={!triage.state.lastDecision} onClick={() => run(() => triage.undo())}>
            ↶ annuler le dernier tri
          </button>
          <button type="button" disabled={!lead.human_score} onClick={() => run(() => triage.clearReview())}>
            effacer ma revue
          </button>
        </div>
        {status ? <ErrorMessage error={status} /> : null}
      </div>
      <div className="d-body">
        <RenderJudge lead={lead} dossier={dossier} mode={mode} />
        <RenderSink item={lead} dossier={dossier} mode={mode} />
        <RenderOrigins
          item={lead}
          dossier={dossier}
          onStep={reveal}
          activeStep={activeStep}
          showAll={showAllOrigins}
          onToggleAll={() => setShowAllOrigins((v) => !v)}
        />
        <Section title="Code" aside="fichier source">
          {sourceError ? (
            <Message kind="bad" text={`✗ ${(sourceError as ApiError as { detail?: string }).detail ?? String(sourceError)}`} />
          ) : !source ? (
            <div className="muted">Chargement du fichier…</div>
          ) : (
            <CodeView
              text={source.text}
              targetLine={source.targetLine}
              marked={lines}
              steps={steps}
              onOpenEditor={() => triage.openInEditor(lead.id)}
              handleRef={codeHandleRef}
              onStepChange={setActiveStep}
            />
          )}
        </Section>
        <RenderFrame item={lead} dossier={dossier} />
        <RenderRaw item={lead} dossier={dossier} />
        <RenderDuplicates duplicates={duplicates} onOpen={(id) => triage.open(id)} />
      </div>
    </>
  );
}
