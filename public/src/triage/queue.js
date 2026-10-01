/**
 * @author [A likely boring stuff made by] Shevek
 * @desc queue.js — Rendu de la file de triage : une ligne par lead, sa fin, la barre des masques et
 *       le total, la sélection courante.
 */

import { clear, el } from "../common/dom.js";
import { HUMAN_LABELS, MASKS } from "./constants.js";
import { priorityOf, sinkText, where } from "../common/format.js";
import { badge, clsTag } from "../common/widgets.js";

export function humanBadge(score) {
  return score ? badge(score, HUMAN_LABELS[score] ?? score) : "";
}

export function queueItem(triage, row) {
  const best = row.judgements?.[0] ?? null;
  const item = el(
    "div",
    {
      className: `q-item p${priorityOf(row)}${row.human_score ? " done" : ""}`,
      onclick: () => triage.open(row.id),
    },
    el(
      "div",
      { className: "q-top" },
      badge(best?.score ?? null),
      ...row.classes.map(clsTag),
      el("span", { textContent: row.analyzer_name }),
      row.method ? el("span", { className: "mono", textContent: row.method }) : "",
      el("span", { className: "id", textContent: `#${row.id}` }),
    ),
    el("div", { className: "q-sink", textContent: sinkText(row) }),
    el(
      "div",
      { className: "q-bottom" },
      badge(row.verdict),
      el("span", { className: "where", textContent: where(row.file, row.line) }),
      humanBadge(row.human_score),
    ),
  );
  item.dataset.id = row.id;
  if (row.id === triage.state.selectedId) item.classList.add("selected");
  return item;
}

const queueNode = (root, id) => root.querySelector(`.q-item[data-id="${id}"]`);

export function renderQueueTail(root, state) {
  root.querySelector(".q-more")?.remove();
  root.querySelector(".q-empty")?.remove();
  if (!state.items.length) {
    root.append(
      el("div", {
        className: "q-empty",
        textContent: "File vide pour ces filtres. Les masques ci-dessus disent ce qui est caché.",
      }),
    );
    return;
  }
  if (!state.isDone) root.append(el("div", { className: "q-more", textContent: "…" }));
}

export function replaceRow(root, triage, id) {
  const row = triage.state.items.find((r) => r.id === id);
  if (row) queueNode(root, id)?.replaceWith(queueItem(triage, row));
}

export function removeRow(root, id) {
  queueNode(root, id)?.remove();
}

export function markSelected(root, id) {
  root.querySelector(".q-item.selected")?.classList.remove("selected");
  const node = queueNode(root, id);
  if (!node) return;
  node.classList.add("selected");
  node.scrollIntoView({ block: "nearest" });
}

export function renderMasks(bar, triage) {
  const { state } = triage;
  clear(bar).append(el("span", { textContent: "Afficher aussi :" }));
  for (const { key, label } of MASKS) {
    const box = el("input", {
      type: "checkbox",
      checked: Boolean(state.masks[key]),
      onchange: () => triage.setMask(key, box.checked),
    });
    const hidden = state.hidden[key];
    bar.append(
      el("label", {}, box, label, hidden === undefined ? "" : el("span", { className: "n", textContent: hidden })),
    );
  }
  bar.append(
    el(
      "span",
      { className: "t-total" },
      el("b", { textContent: String(state.total) }),
      state.total > 1 ? " leads dans la file" : " lead dans la file",
    ),
  );
}
