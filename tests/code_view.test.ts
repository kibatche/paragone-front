/**
 * @author [A likely boring stuff made by] Shevek
 * @desc code_view.test.ts — Tests des calculs de la vue code : fenêtre visible, plage surlignée, découpe du
 *       HTML coloré, étapes du taint.
 */

import { describe, expect, test } from "bun:test";
import {
  centerLine,
  highlightRange,
  scrollTopFor,
  splitHighlightedLines,
  visibleRange,
  visualColumn,
} from "../public/src/triage/code_geometry.js";
import { codeSteps, matchSpan, originLines, stepCaption } from "../public/src/triage/code_steps.js";
import { CODE_BUFFER, LINE_HEIGHT_PX } from "../public/src/triage/constants.js";

describe("fenêtre visible", () => {
  test("ne rend que les lignes à l'écran plus la marge, bornées au fichier", () => {
    const { first, last } = visibleRange(0, 10 * LINE_HEIGHT_PX, 1000);
    expect(first).toBe(0);
    expect(last).toBe(10 + 2 * CODE_BUFFER);
    expect(visibleRange(50 * LINE_HEIGHT_PX - 220, 220, 50).last).toBe(50);
  });

  test("centrer une ligne puis lire la ligne du milieu redonne la même ligne", () => {
    const height = 480;
    expect(centerLine(scrollTopFor(5000, height), height)).toBe(5000);
  });

  test("le début du fichier ne défile pas en négatif", () => {
    expect(scrollTopFor(1, 480)).toBe(0);
  });
});

describe("plage surlignée", () => {
  test("une plage sur une ligne couvre de la colonne de début à celle de fin", () => {
    expect(highlightRange("abcdef", [3, 1, 3, 4], 3)).toEqual({ from: 1, to: 4 });
  });

  test("une plage sur plusieurs lignes couvre la ligne intérieure du premier caractère non blanc à la fin", () => {
    const span = [3, 2, 5, 3];
    expect(highlightRange("zzzz", span, 3)).toEqual({ from: 2, to: 4 });
    expect(highlightRange("  mid", span, 4)).toEqual({ from: 2, to: 5 });
    expect(highlightRange("fin", span, 5)).toEqual({ from: 0, to: 3 });
    expect(highlightRange("hors", span, 6)).toBeNull();
  });

  test("une tabulation avance au taquet suivant", () => {
    expect(visualColumn("\tx", 1)).toBe(8);
    expect(visualColumn("ab\tx", 3)).toBe(8);
  });

  test("une plage absente ou vide ne surligne rien", () => {
    expect(highlightRange("abc", null, 1)).toBeNull();
    expect(highlightRange("abc", [1, 2, 1, 2], 1)).toBeNull();
  });
});

describe("splitHighlightedLines", () => {
  test("rouvre le span qui traverse un saut de ligne", () => {
    expect(splitHighlightedLines('<span class="a">x\ny</span>z')).toEqual([
      '<span class="a">x</span>',
      '<span class="a">y</span>z',
    ]);
  });
});

describe("étapes du taint", () => {
  const lead = {
    line: 10,
    column: 4,
    match_text: "fetch(x)",
    lead: {
      taint: {
        findings: [
          {
            kind: "INTERNAL",
            knownSource: "location.hash",
            loc: { start: { line: 3, column: 1 }, end: { line: 3, column: 9 } },
          },
          { kind: "UNBOUND", text: "Blob\nsuite", loc: null },
        ],
      },
    },
  };

  test("le sink vient d'abord, puis les origines dans l'ordre du dossier", () => {
    const steps = codeSteps(lead);
    expect(steps.map((s) => s.label)).toEqual(["sink", "location.hash", "Blob"]);
    expect(steps[0].span).toEqual([10, 4, 10, 12]);
    expect(steps[1].span).toEqual([3, 1, 3, 9]);
    expect(steps[2].span).toBeNull();
  });

  test("un lead sans taint (inventaire) n'a que le sink", () => {
    expect(codeSteps({ line: 1, column: 0, match_text: "a", lead: {} })).toHaveLength(1);
  });

  test("un nœud désinfectant nomme sa méthode dans son libellé, une source garde le sien", () => {
    const sanitizing = {
      line: 10,
      column: 4,
      match_text: "el.innerHTML = x",
      lead: {
        taint: {
          findings: [
            { kind: "INTERNAL", sanitizeMethod: "sanitize", text: "y.A.sanitize(x)", loc: null },
            { kind: "INTERNAL", knownSource: "location Read", sanitizeMethod: "escape", loc: null },
            { kind: "UNBOUND", sanitizeMethod: "", text: "Blob", loc: null },
          ],
        },
      },
    };
    expect(codeSteps(sanitizing).map((s) => s.label)).toEqual([
      "sink",
      "désinfection : sanitize",
      "location Read",
      "Blob",
    ]);
  });

  test("les lignes désinfectantes sont un sous-ensemble des lignes d'origine", () => {
    const at = (line: number) => ({ start: { line, column: 0 }, end: { line, column: 5 } });
    const lines = originLines([
      { kind: "INTERNAL", sanitizeMethod: "sanitize", loc: at(7) },
      { kind: "INTERNAL", knownSource: "location Read", sanitizeMethod: "", loc: at(3) },
      { kind: "UNBOUND", loc: null },
    ]);
    expect([...lines.origin].sort()).toEqual([3, 7]);
    expect([...lines.sanitized]).toEqual([7]);
  });

  test("un match sur plusieurs lignes se termine sur la dernière", () => {
    expect(matchSpan(4, 2, "ab\ncde")).toEqual([4, 2, 5, 3]);
  });

  test("le libellé dit où l'on en est", () => {
    const steps = codeSteps(lead);
    expect(stepCaption(steps, 1)).toBe("2/3 · location.hash · l. 3");
    expect(stepCaption(steps, 2)).toBe("3/3 · Blob · sans position");
  });
});
