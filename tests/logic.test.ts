/**
 * @author [A likely boring stuff made by] Shevek
 * @desc logic.test.ts — Tests des fonctions pures du front : requêtes, mise en forme, clavier, routage.
 */

import { describe, expect, test } from "bun:test";
import { buildQuery } from "../public/src/common/api.js";
import { bestJudgement, distribution, priorityOf, splitHoles, where } from "../public/src/common/format.js";
import { parseRoute } from "../public/src/shell/route.js";
import { keyAction } from "../public/src/triage/keys.js";
import { INVENTORY_DECISIONS } from "../public/src/triage/constants.js";
import { filtersFromParams } from "../public/src/triage/state.js";

describe("buildQuery", () => {
  test("ignore les valeurs vides, nulles et indéfinies", () => {
    expect(buildQuery({ class: "XSS", q: "", score: null, verdict: undefined })).toBe("?class=XSS");
  });

  test("rend les booléens en 0/1 et garde le zéro", () => {
    expect(buildQuery({ showDuplicates: true, showLiteral: false, offset: 0 })).toBe(
      "?showDuplicates=1&showLiteral=0&offset=0",
    );
  });

  test("est vide sans paramètre", () => {
    expect(buildQuery()).toBe("");
  });

  test("encode les caractères spéciaux", () => {
    expect(buildQuery({ q: "a b&c" })).toBe("?q=a+b%26c");
  });
});

describe("splitHoles", () => {
  test("marque les trous numérotés et nus", () => {
    expect(splitHoles("/api/EXPR#0/x/EXPR")).toEqual([
      { text: "/api/", hole: false },
      { text: "EXPR#0", hole: true },
      { text: "/x/", hole: false },
      { text: "EXPR", hole: true },
    ]);
  });

  test("rend un texte sans trou en un seul morceau", () => {
    expect(splitHoles("fixe")).toEqual([{ text: "fixe", hole: false }]);
  });

  test("tolère l'absence de texte", () => {
    expect(splitHoles(null)).toEqual([]);
  });
});

describe("jugements", () => {
  const judgements = [
    { class: "XSS", score: "MEDIUM", confidence: 0.9 },
    { class: "CSPT", score: "HIGH", confidence: 0.6 },
    { class: "OPEN_REDIRECT", score: "HIGH", confidence: 0.8 },
  ];

  test("le meilleur est le score le plus prioritaire, puis la confiance", () => {
    expect(bestJudgement(judgements)?.class).toBe("OPEN_REDIRECT");
  });

  test("sans jugement, rien", () => {
    expect(bestJudgement([])).toBeNull();
  });

  test("la distribution suit l'ordre des scores et écarte les nulles", () => {
    expect(distribution({ REJECT: 0.1, HIGH: 0.8, MEDIUM: 0, IN_DEPTH: 0.1 })).toEqual([
      { score: "HIGH", p: 0.8 },
      { score: "IN_DEPTH", p: 0.1 },
      { score: "REJECT", p: 0.1 },
    ]);
  });
});

describe("emplacement", () => {
  test("where garde le nom du fichier et la ligne", () => {
    expect(where("/a/b/test.js", 12)).toBe("test.js:12");
    expect(where("/a/b/test.js", null)).toBe("test.js");
  });

  test("priorityOf borne la priorité à 0..3", () => {
    expect(priorityOf({ priority: -2 })).toBe(0);
    expect(priorityOf({ priority: 9 })).toBe(3);
    expect(priorityOf({})).toBe(3);
  });
});

describe("keyAction", () => {
  test("les touches de tri portent le score de leur décision", () => {
    expect(keyAction("a")).toEqual({ name: "decide", score: "LEAD" });
    expect(keyAction("r")).toEqual({ name: "decide", score: "REJECT" });
    expect(keyAction("e")).toEqual({ name: "decide", score: "ESCALATE" });
  });

  test("la navigation et les commandes", () => {
    expect(keyAction("j")).toEqual({ name: "next" });
    expect(keyAction("k")).toEqual({ name: "previous" });
    expect(keyAction("u")).toEqual({ name: "undo" });
    expect(keyAction("/")).toEqual({ name: "search" });
  });

  test("dans un champ de saisie, seule Échap agit", () => {
    expect(keyAction("a", { isTyping: true })).toBeNull();
    expect(keyAction("Escape", { isTyping: true })).toEqual({ name: "blur" });
  });

  test("avec un modificateur, aucun geste", () => {
    expect(keyAction("a", { hasModifier: true })).toBeNull();
  });

  test("dans l'inventaire, e n'escalade pas et i note", () => {
    expect(keyAction("e", { decisions: INVENTORY_DECISIONS })).toBeNull();
    expect(keyAction("i", { decisions: INVENTORY_DECISIONS })).toEqual({ name: "decide", score: "INFO" });
    expect(keyAction("i")).toBeNull();
  });

  test("les flèches gauche et droite parcourent les étapes du code, sauf pendant la saisie", () => {
    expect(keyAction("ArrowLeft")).toEqual({ name: "stepBack" });
    expect(keyAction("ArrowRight")).toEqual({ name: "stepForward" });
    expect(keyAction("ArrowRight", { isTyping: true })).toBeNull();
    expect(keyAction("ArrowRight", { hasModifier: true })).toBeNull();
  });

  test("Échap referme la fenêtre de code", () => {
    expect(keyAction("Escape")).toEqual({ name: "collapse" });
  });

  test("une touche inconnue n'est pas un geste", () => {
    expect(keyAction("z")).toBeNull();
  });
});

describe("routage", () => {
  test("lit la route et ses paramètres", () => {
    const route = parseRoute("#/corpus?tab=matches&file_id=3");
    expect(route.name).toBe("corpus");
    expect(route.params.get("file_id")).toBe("3");
  });

  test("une route inconnue ou absente retombe sur le triage", () => {
    expect(parseRoute("").name).toBe("triage");
    expect(parseRoute("#/nimporte").name).toBe("triage");
  });

  test("les filtres initiaux viennent des paramètres", () => {
    const filters = filtersFromParams(new URLSearchParams("class=XSS&score=HIGH"));
    expect(filters.class).toBe("XSS");
    expect(filters.score).toBe("HIGH");
    expect(filters.q).toBe("");
  });
});
