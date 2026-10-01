/**
 * @author [A likely boring stuff made by] Shevek
 * @desc view.js — Vue des Travaux : configuration en mémoire (dossier, classes, lot), lancement du scan et
 *       du juge, suivi du travail en cours et du dernier terminé.
 */

import * as api from "../common/api.js";
import { clear, el } from "../common/dom.js";
import { formatDate, formatDuration } from "../common/format.js";
import { badge, clsTag, errorMessage, kvGrid, message, section } from "../common/widgets.js";
import { JOBS_POLL_MS, JUDGE_CONFIRMATION } from "./constants.js";

function describeValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Grille des champs d'un objet de bilan (progression, scan, usage), sans les valeurs vides. */
function objectGrid(object) {
  if (!object) return "";
  return kvGrid(Object.entries(object).map(([key, value]) => [key, describeValue(value)]));
}

function jobCard(title, job) {
  if (!job) return section(title, null, el("div", { className: "card muted", textContent: "Aucun travail." }));
  const state = job.state === "error" ? "REJECT" : job.state === "running" ? "MEDIUM" : "CONFIRMED";
  return section(
    title,
    job.id,
    el(
      "div",
      { className: "card" },
      kvGrid([
        ["nature", job.kind],
        ["état", badge(state, job.state)],
        ["début", formatDate(job.started_at)],
        ["durée", formatDuration(job.started_at, job.ended_at)],
        ["classes", el("span", {}, ...job.classes.map(clsTag))],
        ["erreur", job.error ? el("span", { className: "bad", textContent: job.error }) : null],
      ]),
      job.progress ? el("h4", { textContent: "avancement" }) : "",
      objectGrid(job.progress),
      job.scan ? el("h4", { textContent: "bilan du scan" }) : "",
      objectGrid(job.scan),
      job.usage ? el("h4", { textContent: "usage du juge" }) : "",
      objectGrid(job.usage),
    ),
  );
}

function configForm(config, vocabulary, onSave) {
  const analyze = el("input", {
    type: "text",
    value: config.analyze,
    placeholder: "chemin absolu du dossier ou du fichier",
  });
  const batch = el("input", { type: "number", min: 1, value: config.batch });
  const chosen = new Set(config.classes.map((c) => c.toUpperCase()));
  const boxes = vocabulary.impactClasses.map((cls) => {
    const box = el("input", { type: "checkbox", checked: chosen.has(cls) || chosen.has("ALL") });
    return { cls, box };
  });
  const status = el("div", { className: "status" });
  const save = el("button", {
    className: "decide keep",
    textContent: "Enregistrer la configuration",
    onclick: () => {
      const classes = boxes.filter(({ box }) => box.checked).map(({ cls }) => cls);
      onSave({ analyze: analyze.value.trim(), classes, batch: Number(batch.value) }, status);
    },
  });
  return el(
    "div",
    { className: "card form" },
    el("label", {}, "Dossier à analyser", analyze),
    el(
      "div",
      { className: "classes" },
      ...boxes.map(({ cls, box }) => el("label", { className: "inline" }, box, clsTag(cls))),
    ),
    el("label", {}, "Leads envoyés en parallèle au juge", batch),
    save,
    status,
  );
}

/** @return `{ destroy }` */
export function mountJobs(container) {
  const page = el("div", { className: "page" }, el("h2", { textContent: "Travaux" }));
  const configBox = el("div");
  const actionStatus = el("div", { className: "status" });
  const jobsBox = el("div");
  container.replaceChildren(page);
  let timer = 0;
  let isDestroyed = false;

  async function pollJobs() {
    clearTimeout(timer);
    try {
      const { current, last } = await api.getJobs();
      clear(jobsBox).append(jobCard("Travail en cours", current), jobCard("Dernier travail terminé", last));
      if (current && !isDestroyed) timer = setTimeout(pollJobs, JOBS_POLL_MS);
    } catch (error) {
      console.error(error);
      clear(jobsBox).append(errorMessage(error));
    }
  }

  async function save(config, status) {
    try {
      const saved = await api.putConfig(config);
      status.replaceChildren(
        message("ok", `✓ enregistré : ${saved.analyze} · ${saved.classes.join(", ")} · lot ${saved.batch}`),
      );
    } catch (error) {
      console.error(error);
      status.replaceChildren(errorMessage(error));
    }
  }

  async function launch(start) {
    try {
      const job = await start();
      actionStatus.replaceChildren(message("ok", `✓ ${job.kind} lancé (${job.id})`));
    } catch (error) {
      console.error(error);
      actionStatus.replaceChildren(errorMessage(error));
    }
    await pollJobs();
  }

  const actions = el(
    "div",
    { className: "card" },
    el(
      "div",
      { className: "tools" },
      el("button", { className: "decide other", textContent: "Lancer le scan", onclick: () => launch(api.startScan) }),
      el("button", {
        className: "decide escalate",
        textContent: "Lancer le juge",
        onclick: () => confirm(JUDGE_CONFIRMATION) && launch(api.startJudge),
      }),
      el("button", { textContent: "Actualiser", onclick: pollJobs }),
    ),
    actionStatus,
  );

  page.append(
    section("Configuration", "en mémoire, le temps du service", configBox),
    section("Lancer", "un seul travail à la fois", actions),
    jobsBox,
  );

  Promise.all([api.getConfig(), api.getVocabulary()])
    .then(([config, vocabulary]) => configBox.append(configForm(config, vocabulary, save)))
    .catch((error) => {
      console.error(error);
      configBox.append(errorMessage(error));
    });
  pollJobs();

  return {
    destroy() {
      isDestroyed = true;
      clearTimeout(timer);
      container.replaceChildren();
    },
  };
}
