/**
 * @author [A likely boring stuff made by] Shevek
 * @desc view.js — Vue des Statistiques : compteurs et répartitions de la base (`/api/summary`), usage et
 *       coût du juge (`/api/tokens`). Un clic sur une répartition ouvre le triage ainsi filtré.
 */

import * as api from "../common/api.js";
import { el } from "../common/dom.js";
import { formatCost, formatDate, formatNumber } from "../common/format.js";
import { barList, errorMessage, section, table, tile } from "../common/widgets.js";
import { SPLITS } from "./constants.js";

const openTriage = (filter, value) => {
  location.hash = `#/triage?${new URLSearchParams({ [filter]: value })}`;
};

function renderSummary(summary) {
  const splits = SPLITS.map((split) =>
    section(
      split.title,
      split.filter ? "cliquer ouvre le triage filtré" : null,
      barList(summary[split.rows], split.filter ? (value) => openTriage(split.filter, value) : undefined),
    ),
  );
  return el(
    "div",
    {},
    el(
      "div",
      { className: "tiles" },
      tile("leads", summary.totals.total),
      tile("jugés par le juge", summary.totals.agent_judged),
      tile("triés par moi", summary.totals.human_reviewed),
    ),
    el("div", { className: "grid-2" }, ...splits),
  );
}

function tokenTiles(summary) {
  return el(
    "div",
    { className: "tiles" },
    tile("lots", summary.batches),
    tile("lancements", summary.runs),
    tile("tokens en entrée", summary.input),
    tile("tokens en sortie", summary.output),
    tile("lus en cache", summary.cache_read),
    tile("écrits en cache", summary.cache_write),
    tile("total", summary.total),
    tile("coût", formatCost(summary.cost)),
  );
}

function renderTokens(tokens) {
  const runs = table(
    [
      { title: "lancement", cell: (r) => el("span", { className: "mono", textContent: r.run_id }) },
      { title: "début", cell: (r) => formatDate(r.started_at) },
      { title: "classes", cell: (r) => r.classes.join(", ") },
      { title: "phases", cell: (r) => r.phases.join(", ") },
      { title: "lots", cell: (r) => String(r.batches) },
      { title: "entrée", cell: (r) => formatNumber(r.input) },
      { title: "sortie", cell: (r) => formatNumber(r.output) },
      { title: "coût", cell: (r) => formatCost(r.cost) },
    ],
    tokens.runs,
  );
  const byClass = table(
    [
      { title: "classe", cell: (r) => r.sink_type },
      { title: "phase", cell: (r) => r.phase },
      { title: "lots", cell: (r) => String(r.batches) },
      { title: "entrée", cell: (r) => formatNumber(r.input) },
      { title: "sortie", cell: (r) => formatNumber(r.output) },
      { title: "coût", cell: (r) => formatCost(r.cost) },
    ],
    tokens.byClass,
  );
  const byPhase = table(
    [
      { title: "phase", cell: ([phase]) => phase },
      { title: "entrée", cell: ([, u]) => formatNumber(u.input) },
      { title: "sortie", cell: ([, u]) => formatNumber(u.output) },
      { title: "total", cell: ([, u]) => formatNumber(u.total) },
    ],
    Object.entries(tokens.byPhase),
  );
  return el(
    "div",
    {},
    tokenTiles(tokens.summary),
    section("Par lancement", null, runs),
    section("Par classe", null, byClass),
    section("Par phase", null, byPhase),
  );
}

/** @return `{ destroy }` */
export function mountStats(container) {
  const body = el("div", { className: "page" }, el("h2", { textContent: "Statistiques" }));
  container.replaceChildren(body);
  Promise.all([api.getSummary(), api.getTokens()])
    .then(([summary, tokens]) => {
      body.append(renderSummary(summary), el("h2", { textContent: "Usage du juge" }), renderTokens(tokens));
    })
    .catch((error) => {
      console.error(error);
      body.append(errorMessage(error));
    });
  return { destroy: () => container.replaceChildren() };
}
