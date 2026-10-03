/**
 * @author [A likely boring stuff made by] Shevek
 * @desc view.js — Vue du Triage : pose le squelette (compteurs, filtres, masques, file, dossier), branche
 *       chaque changement de triage.state sur son rendu et lie les gestes clavier.
 */

import * as api from "../common/api.js";
import { FILTER_DEBOUNCE_MS } from "../common/constants.js";
import { clear, debounce, el } from "../common/dom.js";
import { clsTag, errorMessage, select } from "../common/widgets.js";
import { IMPACT_MODE } from "./constants.js";
import { renderDossier, renderSource } from "./dossier.js";
import { keyAction } from "./keys.js";
import { markSelected, queueItem, removeRow, renderMasks, renderQueueTail, replaceRow } from "./queue.js";
import { createTriage, filtersFromParams } from "./state.js";

const toOptions = (rows) => rows.map(({ k, n }) => ({ value: k, label: `${k} (${n})` }));

function keysHelp(mode) {
  const box = el("div", { className: "keys" });
  for (const [first, second, text] of mode.keysHelp) {
    box.append(
      el("kbd", { textContent: first }),
      second ? el("kbd", { textContent: second }) : "",
      ` ${text}`,
      el("br"),
    );
  }
  return box;
}

function skeleton(mode) {
  return {
    counters: el("div", { className: "counters" }),
    search: el("input", { type: "search", placeholder: "rechercher : chemin, match, texte reconstruit…  ( / )" }),
    chips: el("div", { className: "chips" }),
    selects: el("div", { className: "selects" }),
    masks: el("div", { className: "masks" }),
    queue: el("div", { className: "queue" }),
    dossier: el(
      "div",
      { className: "dossier" },
      el("div", { className: "placeholder" }, mode.help, el("br"), el("br"), keysHelp(mode)),
    ),
  };
}

function counter(label, value) {
  return el("span", { className: "c" }, `${label} `, el("b", { textContent: String(value) }));
}

function renderCounters(ui, summary) {
  clear(ui.counters).append(
    counter("leads", summary.totals.total),
    counter("jugés", summary.totals.agent_judged),
    counter("triés", summary.totals.human_reviewed),
  );
}

function renderChips(ui, triage, summary, classes) {
  const chip = (value, content, count) => {
    const on = triage.state.filters.class === value;
    return el(
      "button",
      {
        className: `chip${on ? " on" : ""}`,
        onclick: () => {
          triage.setFilter("class", value).catch(console.error);
          renderChips(ui, triage, summary, classes);
        },
      },
      content,
      count === undefined ? "" : el("span", { className: "n", textContent: count }),
    );
  };
  clear(ui.chips).append(chip("", "toutes"));
  for (const { k, n } of summary.byClass.filter(({ k }) => classes.includes(k))) ui.chips.append(chip(k, clsTag(k), n));
}

function fillSelects(ui, triage, summary, vocabulary) {
  const make = (key, placeholder, options) => {
    const field = select(placeholder, options, triage.state.filters[key]);
    field.addEventListener("change", () => triage.setFilter(key, field.value).catch(console.error));
    return field;
  };
  const { mode } = triage;
  const human = make(
    "human",
    "mon verdict",
    [...mode.decisions.map((d) => d.score), ...mode.otherScores].map((s) => ({ value: s, label: mode.labels[s] })),
  );
  if (!mode.isJudged) {
    clear(ui.selects).append(human);
    return;
  }
  clear(ui.selects).append(
    make("analyzer", "analyzer", toOptions(summary.byAnalyzer)),
    make("verdict", "verdict du taint", toOptions(summary.byVerdict)),
    make("score", "score du juge", toOptions(summary.byAgentScore)),
    human,
    make("unjudged", "jugement", [{ value: "1", label: "non jugés seulement" }]),
  );
  const lang = select(
    "",
    vocabulary.languages.map((l) => ({ value: l, label: `dossier ${l}` })),
    triage.state.lang,
  );
  lang.firstElementChild.remove();
  lang.addEventListener("change", () => triage.setLang(lang.value).catch(console.error));
  ui.selects.append(lang);
}

function isTypingTarget(target) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * @param container élément où la vue est montée
 * @param params paramètres de la route (`#/triage?class=XSS`)
 * @param mode IMPACT_MODE (leads d'impact, jugés) ou INVENTORY_MODE (leads d'inventaire, consultés)
 * @return `{ destroy }`
 */
export function mountTriage(container, params, mode = IMPACT_MODE) {
  const triage = createTriage(mode);
  Object.assign(triage.state.filters, filtersFromParams(params));
  const ui = skeleton(mode);
  let shown = null;
  const fail = (error) => {
    console.error(error);
    ui.dossier.prepend(errorMessage(error));
  };

  container.replaceChildren(
    el(
      "div",
      { className: "t-root" },
      mode.isJudged ? el("div", { className: "t-head" }, ui.counters) : "",
      el("div", { className: "t-filters" }, ui.search, ui.chips, ui.selects),
      ui.masks,
      el("div", { className: "t-main" }, ui.queue, ui.dossier),
    ),
  );
  ui.search.value = triage.state.filters.q;

  const handlers = {
    queue: () => {
      clear(ui.queue).scrollTop = 0;
    },
    append: ({ rows }) => {
      ui.queue.querySelector(".q-more")?.remove();
      ui.queue.append(...rows.map((row) => queueItem(triage, row)));
      renderQueueTail(ui.queue, triage.state);
    },
    row: ({ id }) => replaceRow(ui.queue, triage, id),
    remove: ({ id }) => {
      removeRow(ui.queue, id);
      renderQueueTail(ui.queue, triage.state);
    },
    counts: () => renderMasks(ui.masks, triage),
    selection: () => markSelected(ui.queue, triage.state.selectedId),
    dossier: () => {
      shown = renderDossier(ui.dossier, triage);
    },
    source: () => shown && renderSource(shown, triage),
    empty: () => {
      shown = null;
      ui.dossier.replaceChildren(el("div", { className: "placeholder", textContent: "File vide : tout est trié." }));
    },
  };
  const unsubscribe = triage.subscribe((name, detail) => handlers[name]?.(detail));

  ui.search.addEventListener(
    "input",
    debounce(() => triage.setFilter("q", ui.search.value.trim()).catch(fail), FILTER_DEBOUNCE_MS),
  );
  ui.queue.addEventListener("scroll", () => {
    const nearEnd = ui.queue.scrollTop + ui.queue.clientHeight >= ui.queue.scrollHeight - 200;
    if (nearEnd) triage.loadMore().catch(fail);
  });

  const onKey = (event) => {
    const action = keyAction(event.key, {
      isTyping: isTypingTarget(event.target),
      hasModifier: event.ctrlKey || event.metaKey || event.altKey,
      decisions: mode.decisions,
    });
    if (!action) return;
    event.preventDefault();
    const run = {
      next: () => triage.step(1),
      previous: () => triage.step(-1),
      decide: () => triage.decide(action.score, shown?.note.value.trim() ?? ""),
      undo: () => triage.undo(),
      note: () => shown?.note.focus(),
      search: () => ui.search.focus(),
      blur: () => event.target.blur(),
      collapse: () => shown?.codeView?.collapse(),
      stepBack: () => shown?.codeView?.step(-1),
      stepForward: () => shown?.codeView?.step(1),
    };
    Promise.resolve(run[action.name]()).catch(fail);
  };
  document.addEventListener("keydown", onKey);

  Promise.all([api.getSummary(), api.getVocabulary()])
    .then(([summary, vocabulary]) => {
      renderCounters(ui, summary);
      renderChips(ui, triage, summary, mode.classesOf(vocabulary));
      fillSelects(ui, triage, summary, vocabulary);
      return triage.reload();
    })
    .catch(fail);

  return {
    destroy() {
      document.removeEventListener("keydown", onKey);
      unsubscribe();
      container.replaceChildren();
    },
  };
}
