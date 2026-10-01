/**
 * @author [A likely boring stuff made by] Shevek
 * @desc widgets.js — Petits rendus partagés : pastilles, étiquettes de classe, trous de motif, sections,
 *       grilles clé-valeur, code coloré, barres de répartition, tableaux, pagination, messages.
 */

import { el } from "./dom.js";
import { formatNumber, splitHoles } from "./format.js";

/** Pastille ; la valeur sert de classe CSS (HIGH, REJECT, SOURCE_REACHED…). */
export function badge(value, text = value) {
  if (!value) return el("span", { className: "badge unjudged", textContent: "—" });
  return el("span", { className: `badge ${value}`, textContent: text });
}

export function clsTag(cls) {
  return el("span", { className: `cls ${cls}`, textContent: cls });
}

/** Texte dont les trous (`EXPR`, `EXPR#n`) ressortent. */
export function holes(text, soft = false) {
  const box = el("span");
  for (const part of splitHoles(text)) {
    box.append(part.hole ? el("span", { className: soft ? "hole soft" : "hole", textContent: part.text }) : part.text);
  }
  return box;
}

export function section(title, aside, ...content) {
  const heading = el("h3", {}, title);
  if (aside) heading.append(el("span", { className: "aside", textContent: aside }));
  return el("section", { className: "d-section" }, heading, ...content);
}

/** Grille clé-valeur ; les paires sans valeur sont omises. */
export function kvGrid(pairs) {
  const grid = el("div", { className: "kv" });
  for (const [key, value] of pairs) {
    if (value === null || value === undefined || value === "") continue;
    grid.append(el("div", { className: "k", textContent: key }), el("div", { className: "v" }, value));
  }
  return grid;
}

export function paragraphs(text) {
  const box = el("div", { className: "prose" });
  for (const paragraph of String(text).split(/\n{2,}/)) {
    box.append(el("p", { textContent: paragraph }));
  }
  return box;
}

/** Code JavaScript coloré par highlight.js quand il est chargé. */
export function highlightedCode(code) {
  const node = el("code", { className: "language-javascript" });
  if (window.hljs) {
    node.innerHTML = window.hljs.highlight(code, { language: "javascript", ignoreIllegals: true }).value;
  } else {
    node.textContent = code;
  }
  return node;
}

export function codeBlock(code) {
  return el("pre", { className: "carrier" }, highlightedCode(code));
}

export function message(kind, text) {
  return el("p", { className: `msg ${kind}`, textContent: text });
}

export function errorMessage(error) {
  return message("bad", `✗ ${error.message}`);
}

export function tile(label, value) {
  return el(
    "div",
    { className: "tile" },
    el("b", { textContent: typeof value === "number" ? formatNumber(value) : value }),
    el("span", { textContent: label }),
  );
}

/**
 * Liste de barres horizontales proportionnelles au plus grand compte.
 * @param rows `[{ k, n }]` tel que rendu par `/api/summary`
 * @param onPick appelé avec la clé quand on clique une ligne ; absent, les lignes ne sont pas cliquables
 */
export function barList(rows, onPick) {
  const top = Math.max(1, ...rows.map((row) => row.n));
  const list = el("div", { className: "bars" });
  for (const { k, n } of rows) {
    const fill = el("span", { className: "fill" });
    fill.style.width = `${(n / top) * 100}%`;
    const line = el(
      "div",
      { className: onPick ? "bar pick" : "bar" },
      el("span", { className: "bar-key", textContent: k }),
      el("span", { className: "bar-track" }, fill),
      el("span", { className: "bar-n", textContent: formatNumber(n) }),
    );
    if (onPick) line.addEventListener("click", () => onPick(k));
    list.append(line);
  }
  if (!rows.length) list.append(el("div", { className: "muted", textContent: "Aucune donnée." }));
  return list;
}

/** Tableau : `columns` = `[{ title, cell(row) }]`, `cell` rend un texte ou un nœud. */
export function table(columns, rows, { onRow } = {}) {
  const head = el("tr", {}, ...columns.map((c) => el("th", { textContent: c.title })));
  const body = rows.map((row) => {
    const tr = el("tr", {}, ...columns.map((c) => el("td", {}, c.cell(row))));
    if (onRow) {
      tr.className = "pick";
      tr.addEventListener("click", () => onRow(row));
    }
    return tr;
  });
  return el("table", { className: "data" }, el("thead", {}, head), el("tbody", {}, ...body));
}

/** Barre de pagination : précédent / suivant et la plage affichée sur le total. */
export function pager({ offset, limit, total, shown }, onMove) {
  const first = total === 0 ? 0 : offset + 1;
  return el(
    "div",
    { className: "pager" },
    el("button", { textContent: "←", disabled: offset === 0, onclick: () => onMove(Math.max(0, offset - limit)) }),
    el("span", { textContent: `${formatNumber(first)}–${formatNumber(offset + shown)} sur ${formatNumber(total)}` }),
    el("button", {
      textContent: "→",
      disabled: offset + limit >= total,
      onclick: () => onMove(offset + limit),
    }),
  );
}

export function select(placeholder, options, value = "") {
  const field = el("select", {}, el("option", { value: "", textContent: placeholder }));
  for (const { value: v, label } of options) field.append(el("option", { value: v, textContent: label }));
  field.value = value;
  return field;
}
