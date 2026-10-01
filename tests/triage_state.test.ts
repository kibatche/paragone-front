/**
 * @author [A likely boring stuff made by] Shevek
 * @desc triage_state.test.ts — Tests de la logique du triage contre une API simulée : file, filtres, tri,
 *       annulation, navigation, erreur de source.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTriage } from "../public/src/triage/state.js";

type Lead = { id: number; classes: string[]; human_score: string | null; human_note: string | null };
type Call = { method: string; path: string; query: URLSearchParams; body: unknown };

let leads: Lead[];
let calls: Call[];
const realFetch = globalThis.fetch;

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

function installFakeApi() {
  Object.assign(globalThis, { location: { search: "" }, localStorage: { getItem: () => null } });
  globalThis.fetch = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(input, "http://api.test");
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, query: url.searchParams, body });

    const lead = url.pathname.match(/^\/api\/lead\/(\d+)/);
    const found = lead ? leads.find((l) => l.id === Number(lead[1])) : undefined;
    if (url.pathname === "/api/leads") {
      const cls = url.searchParams.get("class");
      return json(leads.filter((l) => !cls || l.classes.includes(cls)));
    }
    if (url.pathname === "/api/leads/count") return json({ total: leads.length, hidden: {} });
    if (url.pathname === "/api/source") return json({ error: "fichier illisible" }, 404);
    if (!found) return json({ error: "lead introuvable" }, 404);
    if (url.pathname.endsWith("/dossier")) return json({ analyzerName: "x", references: [], classes: [] });
    if (url.pathname.endsWith("/duplicates")) return json([]);
    if (url.pathname.endsWith("/human") && method === "POST") {
      found.human_score = body.human_score;
      found.human_note = body.human_note;
      return json({ ok: true });
    }
    if (url.pathname.endsWith("/human") && method === "DELETE") {
      found.human_score = null;
      found.human_note = null;
      return json({ ok: true });
    }
    return json(found);
  }) as typeof fetch;
}

const lead = (id: number, cls = "XSS", human: string | null = null): Lead => ({
  id,
  classes: [cls],
  human_score: human,
  human_note: null,
});

afterEach(() => {
  globalThis.fetch = realFetch;
  Reflect.deleteProperty(globalThis, "location");
  Reflect.deleteProperty(globalThis, "localStorage");
});

beforeEach(() => {
  leads = [lead(1), lead(2, "CSPT"), lead(3)];
  calls = [];
  installFakeApi();
});

describe("file", () => {
  test("le rechargement remplit la file, le total et ouvre le premier lead", async () => {
    const triage = createTriage();
    await triage.reload();
    expect(triage.state.items.map((r: Lead) => r.id)).toEqual([1, 2, 3]);
    expect(triage.state.total).toBe(3);
    expect(triage.state.selectedId).toBe(1);
    expect(triage.state.lead.id).toBe(1);
  });

  test("un filtre repart de la file et envoie son paramètre", async () => {
    const triage = createTriage();
    await triage.reload();
    await triage.setFilter("class", "CSPT");
    expect(triage.state.items.map((r: Lead) => r.id)).toEqual([2]);
    expect(triage.state.selectedId).toBe(2);
    const listing = calls.filter((c) => c.path === "/api/leads").at(-1);
    expect(listing?.query.get("class")).toBe("CSPT");
  });

  test("un masque coché part en 0/1 dans la requête", async () => {
    const triage = createTriage();
    await triage.setMask("showDuplicates", true);
    const listing = calls.find((c) => c.path === "/api/leads");
    expect(listing?.query.get("showDuplicates")).toBe("1");
  });

  test("step avance, recule et reste borné", async () => {
    const triage = createTriage();
    await triage.reload();
    await triage.step(1);
    expect(triage.state.selectedId).toBe(2);
    await triage.step(-1);
    await triage.step(-1);
    expect(triage.state.selectedId).toBe(1);
  });
});

describe("tri", () => {
  test("decide enregistre le verdict et la note, retire le lead et ouvre le suivant", async () => {
    const triage = createTriage();
    await triage.reload();
    await triage.decide("LEAD", "à creuser");
    const post = calls.find((c) => c.method === "POST");
    expect(post?.path).toBe("/api/lead/1/human");
    expect(post?.body).toEqual({ human_score: "LEAD", human_note: "à creuser" });
    expect(triage.state.items.map((r: Lead) => r.id)).toEqual([2, 3]);
    expect(triage.state.total).toBe(2);
    expect(triage.state.selectedId).toBe(2);
  });

  test("décider du dernier lead vide la file et annonce « empty »", async () => {
    leads = [lead(1)];
    const triage = createTriage();
    const events: string[] = [];
    triage.subscribe((name: string) => events.push(name));
    await triage.reload();
    await triage.decide("REJECT");
    expect(events).toContain("empty");
    expect(triage.state.selectedId).toBeNull();
  });

  test("annuler sans verdict antérieur efface la revue", async () => {
    const triage = createTriage();
    await triage.reload();
    await triage.decide("LEAD");
    await triage.undo();
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/lead/1/human")).toBe(true);
    expect(leads[0].human_score).toBeNull();
    expect(triage.state.selectedId).toBe(1);
    expect(triage.state.lastDecision).toBeNull();
  });

  test("annuler remet le verdict d'avant quand il y en avait un", async () => {
    leads = [lead(1, "XSS", "REJECT")];
    const triage = createTriage();
    await triage.setMask("showReviewed", true);
    await triage.decide("LEAD");
    expect(leads[0].human_score).toBe("LEAD");
    await triage.undo();
    expect(leads[0].human_score).toBe("REJECT");
  });

  test("sans lead ouvert, decide et undo ne font aucun appel d'écriture", async () => {
    const triage = createTriage();
    await triage.decide("LEAD");
    await triage.undo();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });
});

describe("source", () => {
  test("une source illisible est gardée comme erreur, le lead reste ouvert", async () => {
    const triage = createTriage();
    await triage.reload();
    expect(triage.state.sourceError?.status).toBe(404);
    expect(triage.state.sourceError?.message).toContain("GET");
    expect(triage.state.sourceError?.message).toContain("fichier illisible");
    expect(triage.state.lead.id).toBe(1);
  });
});
