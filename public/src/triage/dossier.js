/**
 * @author [A likely boring stuff made by] Shevek
 * @desc dossier.js — Rendu du lead ouvert : en-tête et barre de tri, verdict du juge, sink, origines de la
 *       valeur, doublons, cadre de jugement, code source, matière brute. Rend ce que triage.state détient.
 */

import * as api from "../common/api.js";
import { JUDGE_SCORES } from "../common/constants.js";
import { el } from "../common/dom.js";
import { distribution, optionsText, percent, where } from "../common/format.js";
import {
  badge,
  clsTag,
  codeBlock,
  errorMessage,
  foldedSection,
  holes,
  kvGrid,
  message,
  paragraphs,
  section,
} from "../common/widgets.js";
import { buildCodeView } from "./code_view.js";
import { codeSteps, isSanitized, originLines, sanitizerLabel } from "./code_steps.js";
import { SLOT_LABELS, SOURCE_KIND, UNJUDGED } from "./constants.js";
import { humanBadge } from "./queue.js";

/** Un jugement par classe d'impact du lead, y compris celles que le juge n'a pas encore vues. */
function judgementsOf(lead) {
  return lead.classes.map((cls) => lead.judgements.find((j) => j.class === cls) ?? { class: cls, score: UNJUDGED });
}

function distributionBar(probabilities) {
  const parts = distribution(probabilities);
  if (!parts.length) return "";
  const bar = el("div", { className: "dist" });
  const legend = el("div", { className: "dist-legend" });
  for (const { score, p } of parts) {
    const slice = el("span", { className: score, title: score });
    slice.style.width = `${p * 100}%`;
    bar.append(slice);
    legend.append(el("span", { textContent: `${score} ${percent(p)}` }));
  }
  return el("div", {}, bar, legend);
}

function judgeCard(judgement, classFrame) {
  const head = el("div", { className: "jev-head" }, clsTag(judgement.class));
  if (judgement.score === UNJUDGED) {
    head.append(badge(null));
    return el(
      "div",
      { className: "card" },
      head,
      el("div", { className: "muted", textContent: "Pas encore jugé pour cette classe." }),
    );
  }
  head.append(
    el("span", { className: `jev-score badge ${judgement.score}`, textContent: judgement.score }),
    el("span", { className: "muted", textContent: `confiance ${percent(judgement.confidence)}` }),
    el("span", { className: "faint", textContent: judgement.model }),
  );
  const reason = judgement.reject_reason;
  return el(
    "div",
    { className: "card" },
    head,
    distributionBar(judgement.probabilities),
    classFrame?.scores?.[judgement.score]
      ? el("div", { className: "jev-meaning", textContent: classFrame.scores[judgement.score] })
      : "",
    reason
      ? el(
          "div",
          { className: "jev-reason" },
          el("b", { textContent: `Motif de rejet : ${reason}` }),
          classFrame?.reasons?.[reason] ? ` — ${classFrame.reasons[reason]}` : "",
        )
      : "",
    judgement.note ? el("div", { className: "prose", textContent: judgement.note }) : "",
  );
}

function renderJudge(lead, dossier, mode) {
  if (!mode.isJudged) return "";
  const cards = judgementsOf(lead).map((j) =>
    judgeCard(
      j,
      dossier?.classes.find((c) => c.cls === j.class),
    ),
  );
  return section("Verdict du juge", "signal de triage, pas une preuve", el("div", { className: "grid-2" }, ...cards));
}

function renderSink(item, dossier, mode) {
  const taint = item.lead.taint;
  const slot = SLOT_LABELS[item.lead.slot?.kind]?.(item.lead.slot);
  const request = item.lead.request;
  return section(
    mode.sinkTitle,
    null,
    el(
      "div",
      { className: "card" },
      kvGrid([
        ["motif", item.pattern ? el("span", { className: "pattern" }, holes(item.pattern)) : null],
        ["reconstruit", item.reconstructed ? el("code", { textContent: item.reconstructed }) : null],
        ["emplacement", slot],
        ["méthode", request?.method ?? null],
        ["options", optionsText(request?.options) || null],
        [
          "verdict du taint",
          taint
            ? el(
                "span",
                {},
                badge(taint.verdict),
                dossier?.verdictLegend
                  ? el("span", { className: "muted", textContent: ` ${dossier.verdictLegend}` })
                  : "",
              )
            : mode.isJudged
              ? el("span", { className: "muted", textContent: "pas de taint" })
              : null,
        ],
        ["fichier", el("code", { textContent: `${item.file}:${item.line}:${item.column}` })],
      ]),
    ),
    codeBlock(item.match_text),
  );
}

function originNode(finding, dossier, onStep) {
  const isSource = finding.kind === SOURCE_KIND && finding.knownSource;
  const classes = ["origin"];
  if (isSource) classes.push("source");
  else if (finding.kind !== SOURCE_KIND) classes.push("stop");
  if (isSanitized(finding)) classes.push("sanitized");
  if (finding.derivedFrom !== undefined) classes.push("derived");
  const line = finding.loc?.start?.line;
  const stopLegend = dossier?.endKindLegend?.[finding.kind];
  return el(
    "li",
    { className: classes.join(" ") },
    el(
      "div",
      { className: "origin-head" },
      el("span", { className: "rank", textContent: `${finding.id}.` }),
      isSource ? el("span", { className: "src", textContent: finding.knownSource }) : "",
      isSanitized(finding)
        ? el("span", {
            className: "san",
            textContent: sanitizerLabel(finding),
            title: "la valeur traverse cet appel : un désinfectant, pas forcément adapté au sink",
          })
        : "",
      finding.derivedFrom !== undefined
        ? el("span", { className: "faint", textContent: `dérivée de n°${finding.derivedFrom}` })
        : "",
      line
        ? el("button", {
            className: "linelink",
            textContent: `ligne ${line}`,
            title: "voir dans le code",
            onclick: onStep,
          })
        : "",
    ),
    el("div", { className: "origin-text", textContent: finding.text ?? "" }),
    finding.sourceString ? el("div", { className: "origin-code", textContent: finding.sourceString }) : "",
    finding.path?.length
      ? el("div", {
          className: "faint path",
          textContent: finding.path.map((step) => step.label ?? step.role).join(" ← "),
        })
      : "",
    finding.kind !== SOURCE_KIND
      ? el(
          "div",
          { className: "origin-stop" },
          el("b", { textContent: `Arrêt : ${finding.kind}` }),
          stopLegend ? ` — ${stopLegend}` : "",
          finding.endReason ? ` (${finding.endReason})` : "",
        )
      : "",
  );
}

function omittedText(omitted) {
  return Object.entries(omitted ?? {})
    .map(([reason, count]) => `${count} × ${reason}`)
    .join(" · ");
}

function renderOrigins(item, dossier, onStep) {
  const taint = item.lead.taint;
  if (!taint) return "";
  if (!taint.findings.length) {
    return section(
      "D'où vient la valeur",
      null,
      el("div", { className: "card muted", textContent: "Aucune origine retenue par le résolveur." }),
    );
  }
  const omitted = omittedText(taint.omitted);
  return section(
    "D'où vient la valeur",
    "du sink vers la source",
    el(
      "ol",
      { className: "chain" },
      ...taint.findings.map((f, index) => originNode(f, dossier, () => onStep(index + 1))),
    ),
    omitted ? el("div", { className: "faint omitted", textContent: `Écartés : ${omitted}` }) : "",
  );
}

function renderDuplicates(duplicates, triage) {
  if (!duplicates.length) return "";
  const rows = duplicates.map((row) =>
    el(
      "button",
      { className: "dup", onclick: () => triage.open(row.id) },
      el("span", { className: "id", textContent: `#${row.id}` }),
      el("span", { className: "where", textContent: where(row.file, row.line) }),
    ),
  );
  return foldedSection(
    "Doublons",
    `${duplicates.length} lead(s) identique(s)`,
    el("div", { className: "dups" }, ...rows),
  );
}

function renderFrame(item, dossier) {
  if (!dossier?.classes.length) return "";
  const best = (cls) => item.judgements.find((j) => j.class === cls)?.score;
  const blocks = dossier.classes.map((frame) => {
    const scale = el("div", { className: "scale" });
    for (const score of JUDGE_SCORES) {
      scale.append(
        el(
          "div",
          { className: `scale-row${best(frame.cls) === score ? " current" : ""}` },
          badge(score),
          el("span", { textContent: frame.scores?.[score] ?? "" }),
        ),
      );
    }
    return el(
      "div",
      { className: "frame" },
      el("div", { className: "label" }, `${dossier.analyzerName} · `, clsTag(frame.cls)),
      frame.guidance ? paragraphs(frame.guidance) : "",
      scale,
      el("details", {}, el("summary", { textContent: "définition de la classe" }), paragraphs(frame.definition)),
    );
  });
  const refs = dossier.references.map((ref) =>
    el("li", {}, el("a", { href: ref.url, target: "_blank", rel: "noreferrer noopener", textContent: ref.label })),
  );
  return section(
    "Cadre de jugement",
    "ce que le juge a reçu comme consigne",
    ...blocks,
    refs.length ? el("ul", { className: "refs" }, ...refs) : "",
  );
}

function renderRaw(item, dossier) {
  const texts = (dossier?.classes ?? []).map((frame) =>
    el(
      "details",
      {},
      el("summary", { textContent: `texte envoyé au juge — ${frame.cls}` }),
      el("pre", { className: "raw", textContent: frame.caseText }),
    ),
  );
  return section(
    "Matière brute",
    null,
    ...texts,
    el(
      "details",
      {},
      el("summary", { textContent: "lead (JSON)" }),
      el("pre", { className: "raw", textContent: JSON.stringify(item.lead, null, 2) }),
    ),
  );
}

function renderHead(item, triage, run, status) {
  const note = el("textarea", {
    className: "note",
    placeholder: "commentaire (touche n)",
    rows: 2,
    value: item.human_note ?? "",
  });
  const decide = (score) => run(() => triage.decide(score, note.value.trim()));
  const { mode } = triage;
  const buttons = mode.decisions.map(({ score, key, label, icon, css }) =>
    el(
      "button",
      { className: `decide ${css}`, onclick: () => decide(score) },
      `${icon} ${label}`,
      el("kbd", { textContent: key }),
    ),
  );
  const others = mode.otherScores.map((score) =>
    el("button", { className: `decide other ${score}`, textContent: mode.labels[score], onclick: () => decide(score) }),
  );
  const tools = [
    el("button", {
      textContent: "↶ annuler le dernier tri",
      disabled: !triage.state.lastDecision,
      onclick: () => run(() => triage.undo()),
    }),
    el("button", {
      textContent: "effacer ma revue",
      disabled: !item.human_score,
      onclick: () => run(() => triage.clearReview()),
    }),
  ];
  return {
    note,
    node: el(
      "div",
      { className: "d-head" },
      el(
        "div",
        { className: "d-title" },
        el("span", { className: "id", textContent: `#${item.id}` }),
        el("span", { className: "sink", textContent: item.match_text }),
      ),
      el(
        "div",
        { className: "d-tags" },
        ...item.classes.map(clsTag),
        el("span", { textContent: item.analyzer }),
        el("span", { className: "sep", textContent: "·" }),
        el("span", { className: "mono", textContent: where(item.file, item.line) }),
        humanBadge(item.human_score, mode.labels),
      ),
      el("div", { className: "triage-bar" }, ...buttons, ...others),
      note,
      el("div", { className: "tools" }, ...tools),
      status,
    ),
  };
}

/**
 * @param root conteneur du dossier
 * @return `{ note, codeSlot }` : la zone de commentaire, et l'emplacement du code que `renderSource` remplit
 */
export function renderDossier(root, triage) {
  const { lead, dossier, duplicates } = triage.state;
  const status = el("div", { className: "status" });
  const run = (action) =>
    action().catch((error) => {
      console.error(error);
      status.replaceChildren(errorMessage(error));
    });
  const head = renderHead(lead, triage, run, status);
  const codeSlot = el("div", { className: "code-slot" });
  const reveal = { showStep: () => {} };
  const handle = { note: head.note, codeSlot, reveal, codeView: null };
  root.replaceChildren(
    head.node,
    el(
      "div",
      { className: "d-body" },
      renderJudge(lead, dossier, triage.mode),
      renderSink(lead, dossier, triage.mode),
      renderOrigins(lead, dossier, (index) => reveal.showStep(index)),
      section("Code", "fichier source", codeSlot),
      renderFrame(lead, dossier),
      renderRaw(lead, dossier),
      renderDuplicates(duplicates, triage),
    ),
  );
  renderSource(handle, triage);
  return handle;
}

export function renderSource(handle, triage) {
  const { lead, source, sourceError } = triage.state;
  if (sourceError) {
    handle.codeSlot.replaceChildren(message("bad", `✗ ${sourceError.detail ?? sourceError.message}`));
    return;
  }
  if (!source) {
    handle.codeSlot.replaceChildren(el("div", { className: "muted", textContent: "Chargement du fichier…" }));
    return;
  }
  const lines = originLines(lead.lead.taint?.findings ?? []);
  const view = buildCodeView(source, lines, codeSteps(lead), () => api.openInEditor(lead.id));
  handle.reveal.showStep = view.showStep;
  handle.codeView = view;
  handle.codeSlot.replaceChildren(view.wrap);
  view.center();
}
