/**
 * @author [A likely boring stuff made by] Shevek
 * @desc code_view.js — Vue du fichier source d'un lead : fenêtre de lignes autour de la cible, que l'on
 *       élargit à la demande, ligne cible et lignes d'origines marquées, lignes trop longues repliées.
 */

import { CODE_CONTEXT_LINES, CODE_LINE_LIMIT } from "./constants.js";
import { el } from "../common/dom.js";
import { lineWindow } from "../common/format.js";
import { highlightedCode } from "../common/widgets.js";

const more = (label, onclick) => el("button", { className: "more", textContent: label, onclick });

function renderLine(number, text, marks) {
  const isFolded = text.length > CODE_LINE_LIMIT;
  const code = el("span", { className: "code" });
  const show = (full) => {
    const shown = full || !isFolded ? text : text.slice(0, CODE_LINE_LIMIT);
    code.replaceChildren(highlightedCode(shown));
    if (isFolded && !full) {
      code.append(
        el("button", {
          className: "unfold",
          textContent: `… ${text.length - CODE_LINE_LIMIT} caractères de plus`,
          onclick: () => show(true),
        }),
      );
    }
  };
  show(false);
  const classes = ["cline"];
  if (marks.target === number) classes.push("target");
  else if (marks.origins.has(number)) classes.push("origin");
  const line = el("div", { className: classes.join(" ") }, el("span", { className: "ln", textContent: number }), code);
  line.dataset.line = number;
  return line;
}

/**
 * @param source `{ file, targetLine, text }` rendu par `/api/source`
 * @param originLines numéros de ligne des origines du taint
 * @return `{ node, reveal(line) }` : `reveal` recentre la fenêtre et fait défiler jusqu'à la ligne
 */
export function buildCodeView(source, originLines = []) {
  const marks = { target: source.targetLine, origins: new Set(originLines) };
  const body = el("div", { className: "code-body" });
  let center = source.targetLine;
  let context = CODE_CONTEXT_LINES;

  const render = () => {
    const win = lineWindow(source.text, center, context);
    body.replaceChildren();
    if (win.from > 1) {
      body.append(more("↑ lignes précédentes", () => ((context += CODE_CONTEXT_LINES), render())));
    }
    win.lines.forEach((text, index) => body.append(renderLine(win.from + index, text, marks)));
    if (win.to < win.total) {
      body.append(more("↓ lignes suivantes", () => ((context += CODE_CONTEXT_LINES), render())));
    }
    head.textContent = `${source.file} — lignes ${win.from}–${win.to} sur ${win.total}`;
  };

  const head = el("div", { className: "code-head" });
  const node = el("div", { className: "code-view" }, head, body);
  render();

  const reveal = (line) => {
    const win = lineWindow(source.text, center, context);
    if (line < win.from || line > win.to) {
      center = line;
      render();
    }
    const target = body.querySelector(`[data-line="${line}"]`);
    target?.scrollIntoView({ block: "center" });
  };
  return { node, reveal };
}
