/**
 * @author [A likely boring stuff made by] Shevek
 * @desc view.js — Vue du Corpus : fichiers scannés et matches des analyzers, filtrés et paginés ; un clic
 *       sur un fichier ouvre ses matches.
 */

import * as api from "../common/api.js";
import { FILTER_DEBOUNCE_MS } from "../common/constants.js";
import { clear, debounce, el } from "../common/dom.js";
import { formatDate, shortFile } from "../common/format.js";
import { badge, errorMessage, pager, select, table } from "../common/widgets.js";
import { FILE_STATUSES, FILES, MATCHES, TABLE_PAGE } from "./constants.js";

const monoCell = (text, title = text) => el("span", { className: "mono clip", textContent: text, title });

function filesColumns() {
  return [
    { title: "fichier", cell: (f) => monoCell(f.path) },
    { title: "statut", cell: (f) => badge(f.status) },
    { title: "matches", cell: (f) => String(f.matches) },
    { title: "leads", cell: (f) => String(f.leads) },
    { title: "scanné", cell: (f) => formatDate(f.scanned_at) },
    { title: "erreur", cell: (f) => f.error ?? "" },
  ];
}

function matchesColumns() {
  return [
    { title: "analyzer", cell: (m) => m.analyzer },
    { title: "fichier", cell: (m) => monoCell(shortFile(m.file), m.file) },
    { title: "position", cell: (m) => `${m.start_line}:${m.start_column} → ${m.end_line}:${m.end_column}` },
    { title: "leads", cell: (m) => String(m.leads) },
    { title: "match", cell: (m) => monoCell(m.value) },
  ];
}

/**
 * @param container élément où la vue est montée
 * @param params paramètres de la route : `tab` (files|matches), `file_id`, `analyzer`, `status`, `q`
 * @return `{ destroy }`
 */
export function mountCorpus(container, params) {
  const state = {
    tab: params.get("tab") === MATCHES ? MATCHES : FILES,
    offset: 0,
    status: params.get("status") ?? "",
    q: params.get("q") ?? "",
    file_id: params.get("file_id") ?? "",
    analyzer: params.get("analyzer") ?? "",
  };
  const tabs = el("div", { className: "tabs" });
  const controls = el("div", { className: "controls" });
  const results = el("div", { className: "results" });
  container.replaceChildren(
    el("div", { className: "page" }, el("h2", { textContent: "Corpus" }), tabs, controls, results),
  );

  const pageQuery = () => {
    if (state.tab === FILES) return { status: state.status, q: state.q };
    return { file_id: state.file_id, analyzer: state.analyzer };
  };

  async function load() {
    const filters = pageQuery();
    const page = { ...filters, limit: TABLE_PAGE, offset: state.offset };
    const isFiles = state.tab === FILES;
    const [rows, count] = await Promise.all([
      isFiles ? api.listFiles(page) : api.listMatches(page),
      isFiles ? api.countFiles(filters) : api.countMatches(filters),
    ]);
    const paging = () =>
      pager({ offset: state.offset, limit: TABLE_PAGE, total: count.total, shown: rows.length }, (offset) =>
        update({ offset }, false),
      );
    const onRow = isFiles ? (file) => switchTab(MATCHES, { file_id: String(file.id) }) : undefined;
    const columns = isFiles ? filesColumns() : matchesColumns();
    clear(results).append(paging(), table(columns, rows, { onRow }), paging());
  }

  function refresh() {
    load().catch((error) => {
      console.error(error);
      clear(results).append(errorMessage(error));
    });
  }

  function update(patch, resetOffset = true) {
    Object.assign(state, patch);
    if (resetOffset) state.offset = 0;
    refresh();
  }

  function switchTab(tab, patch = {}) {
    Object.assign(state, patch, { tab, offset: 0 });
    drawChrome();
    refresh();
  }

  const typed = (field, key) =>
    field.addEventListener(
      "input",
      debounce(() => update({ [key]: field.value.trim() }), FILTER_DEBOUNCE_MS),
    );

  function drawChrome() {
    clear(tabs).append(
      ...[FILES, MATCHES].map((tab) =>
        el("button", {
          className: `tab${state.tab === tab ? " on" : ""}`,
          textContent: tab === FILES ? "Fichiers" : "Matches",
          onclick: () => switchTab(tab),
        }),
      ),
    );
    clear(controls);
    if (state.tab === FILES) {
      const search = el("input", { type: "search", placeholder: "chemin contient…", value: state.q });
      typed(search, "q");
      const statuses = FILE_STATUSES.map((s) => ({ value: s, label: s }));
      const status = select("statut", statuses, state.status);
      status.addEventListener("change", () => update({ status: status.value }));
      controls.append(search, status);
      return;
    }
    const analyzer = el("input", { type: "search", placeholder: "analyzer (nom exact)", value: state.analyzer });
    typed(analyzer, "analyzer");
    const fileId = el("input", { type: "number", min: 1, placeholder: "id du fichier", value: state.file_id });
    typed(fileId, "file_id");
    controls.append(analyzer, fileId);
  }

  drawChrome();
  refresh();
  return { destroy: () => container.replaceChildren() };
}
