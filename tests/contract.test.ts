/**
 * @author [A likely boring stuff made by] Shevek
 * @desc contract.test.ts — Chaque opération du contrat OpenAPI a son appelant dans api.js. Lit le contrat de
 *       l'API vivante (PARAGONE_API=http://127.0.0.1:7331) ; sans elle, seule la table est vérifiée.
 */

import { describe, expect, test } from "bun:test";
import * as api from "../public/src/common/api.js";

const OPERATIONS: Record<string, string> = {
  "GET /api/meta": "getMeta",
  "GET /api/summary": "getSummary",
  "GET /api/tokens": "getTokens",
  "GET /api/leads": "listLeads",
  "GET /api/leads/count": "countLeads",
  "GET /api/lead/{id}": "getLead",
  "GET /api/lead/{id}/dossier": "getDossier",
  "GET /api/lead/{id}/duplicates": "listDuplicates",
  "POST /api/lead/{id}/human": "setHuman",
  "DELETE /api/lead/{id}/human": "clearHuman",
  "GET /api/source": "getSource",
  "POST /api/lead/{id}/open": "openInEditor",
  "GET /api/files": "listFiles",
  "GET /api/files/count": "countFiles",
  "GET /api/matches": "listMatches",
  "GET /api/matches/count": "countMatches",
  "GET /api/vocabulary": "getVocabulary",
  "GET /api/analyzers": "listAnalyzers",
  "GET /api/config": "getConfig",
  "PUT /api/config": "putConfig",
  "POST /api/scan": "startScan",
  "POST /api/judge": "startJudge",
  "GET /api/jobs": "getJobs",
};

const LIVE = process.env.PARAGONE_API;

describe("contrat", () => {
  test("chaque opération de la table a une fonction exportée", () => {
    for (const name of Object.values(OPERATIONS)) {
      expect(typeof (api as Record<string, unknown>)[name]).toBe("function");
    }
  });

  test.skipIf(!LIVE)("la table couvre exactement les opérations de l'API vivante", async () => {
    const contract = await (await fetch(`${LIVE}/openapi/json`)).json();
    const live: string[] = [];
    for (const [path, methods] of Object.entries<Record<string, unknown>>(contract.paths)) {
      if (!path.startsWith("/api/")) continue;
      for (const method of Object.keys(methods)) live.push(`${method.toUpperCase()} ${path}`);
    }
    expect(live.sort()).toEqual(Object.keys(OPERATIONS).sort());
  });
});
