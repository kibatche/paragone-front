/**
 * @author [A likely boring stuff made by] Shevek
 * @desc code_view.js — Vue du fichier entier d'un lead, virtualisée : seules les lignes visibles vivent
 *       dans le DOM. La ligne du sink est la cible, celles des origines sont marquées ; les étapes du
 *       taint se parcourent une à une avec leur portion surlignée ; la fenêtre se redimensionne,
 *       s'agrandit sur tout l'écran et se ferme. Les calculs vivent dans code_geometry.js.
 */

import { el } from "../common/dom.js";
import { CODE_GUTTER_PX, LINE_HEIGHT_PX } from "./constants.js";
import {
  centerLine,
  escapeHtml,
  highlightRange,
  scrollTopFor,
  splitHighlightedLines,
  visibleRange,
} from "./code_geometry.js";
import { stepCaption } from "./code_steps.js";

const FAILURE_LABEL_MS = 3000;

function highlightedHtml(slice) {
  if (!window.hljs) return escapeHtml(slice);
  return window.hljs.highlight(slice, { language: "javascript", ignoreIllegals: true }).value;
}

/**
 * @param source `{ file, targetLine, text }` rendu par `/api/source`
 * @param marked numéros de ligne à marquer (origines du taint)
 * @param steps `[{ label, span }]` : le sink, puis les origines
 * @param onOpenEditor ouvre le fichier dans l'éditeur local ; rend une promesse
 * @return `{ wrap, reveal(line), showStep(index), step(delta), center(), collapse() }`
 */
export function buildCodeView(source, marked, steps, onOpenEditor) {
  const lines = (source.text ?? "").split(/\r?\n/);
  const viewport = el("div", { className: "codeview" });
  const spacer = el("div", { className: "code-spacer" });
  spacer.style.height = `${lines.length * LINE_HEIGHT_PX}px`;
  const slab = el("div", { className: "code-window" });
  spacer.append(slab);
  viewport.append(spacer);
  let currentStep = 0;

  const lineClass = (number) => {
    if (number === source.targetLine) return "cline target";
    return marked.has(number) ? "cline mark" : "cline";
  };

  function stepMark(number) {
    const range = highlightRange(lines[number - 1] ?? "", steps[currentStep]?.span, number);
    if (!range) return "";
    const mark = el("span", { className: "step-hl" });
    mark.style.left = `calc(${CODE_GUTTER_PX}px + ${range.from}ch)`;
    mark.style.width = `${range.to - range.from}ch`;
    return mark;
  }

  function render() {
    const { first, last } = visibleRange(viewport.scrollTop, viewport.clientHeight, lines.length);
    const html = highlightedHtml(lines.slice(first, last).join("\n"));
    slab.style.transform = `translateY(${first * LINE_HEIGHT_PX}px)`;
    slab.replaceChildren(
      ...splitHighlightedLines(html).map((lineHtml, index) => {
        const number = first + index + 1;
        const code = el("span", { className: "src" });
        code.innerHTML = lineHtml || " ";
        return el(
          "div",
          { className: lineClass(number) },
          el("span", { className: "ln", textContent: String(number) }),
          code,
          stepMark(number),
        );
      }),
    );
  }

  function goTo(line) {
    viewport.scrollTop = scrollTopFor(line, viewport.clientHeight);
    render();
  }

  let pendingFrame = 0;
  function scheduleRender() {
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      render();
    });
  }
  viewport.addEventListener("scroll", scheduleRender);
  new ResizeObserver(scheduleRender).observe(viewport);

  const wrap = el("div", { className: "codeview-wrap" });
  const isExpanded = () => wrap.classList.contains("expanded");

  /** Amène la fenêtre dans le champ de vision du dossier, puis la ligne dans la fenêtre. */
  function reveal(line) {
    if (!isExpanded()) wrap.scrollIntoView({ block: "nearest" });
    goTo(line);
  }

  const expandButton = el("button", { textContent: "⤢ agrandir" });
  /** Bascule le plein écran en gardant la ligne du milieu. */
  function setExpanded(expanded) {
    if (isExpanded() === expanded) return;
    const line = centerLine(viewport.scrollTop, viewport.clientHeight);
    wrap.classList.toggle("expanded", expanded);
    expandButton.textContent = expanded ? "✕ fermer (Échap)" : "⤢ agrandir";
    if (expanded) goTo(line);
    else reveal(line);
  }
  expandButton.onclick = () => setExpanded(!isExpanded());

  const resetButton = el("button", {
    textContent: "↺ taille par défaut",
    onclick: () => {
      setExpanded(false);
      viewport.style.height = "";
      reveal(source.targetLine);
    },
  });
  const sinkButton = el("button", {
    textContent: `↩ sink (l. ${source.targetLine})`,
    onclick: () => showStep(0),
  });

  const stepLabel = el("span", { className: "step-label" });
  const previousStep = el("button", {
    textContent: "◀",
    title: "étape précédente",
    onclick: () => showStep(currentStep - 1),
  });
  const nextStep = el("button", {
    textContent: "▶",
    title: "étape suivante",
    onclick: () => showStep(currentStep + 1),
  });

  function renderStepControls() {
    previousStep.disabled = currentStep <= 0;
    nextStep.disabled = currentStep >= steps.length - 1;
    stepLabel.textContent = stepCaption(steps, currentStep);
    stepLabel.title = steps[currentStep]?.label ?? "";
  }

  /** Passe à l'étape `index` : la portion est surlignée et la fenêtre y est amenée. */
  function showStep(index) {
    if (index < 0 || index >= steps.length) return;
    currentStep = index;
    renderStepControls();
    const line = steps[index].span?.[0];
    if (line) reveal(line);
    else render();
  }
  renderStepControls();

  const editorButton = el("button", {
    textContent: "↗ éditeur",
    title: "ouvrir le fichier à la ligne du sink",
    onclick: async () => {
      const label = "↗ éditeur";
      try {
        await onOpenEditor();
      } catch (error) {
        console.error(error);
        editorButton.textContent = "échec de l'ouverture";
        editorButton.title = error.message;
        setTimeout(() => (editorButton.textContent = label), FAILURE_LABEL_MS);
      }
    },
  });

  wrap.append(
    el(
      "div",
      { className: "code-tools" },
      el("div", { className: "step-tools" }, previousStep, stepLabel, nextStep),
      sinkButton,
      editorButton,
      expandButton,
      resetButton,
    ),
    viewport,
  );
  return {
    wrap,
    reveal,
    showStep,
    center: () => goTo(steps[currentStep]?.span?.[0] ?? source.targetLine),
    step: (delta) => showStep(currentStep + delta),
    collapse: () => setExpanded(false),
  };
}
