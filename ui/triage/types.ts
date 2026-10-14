/**
 * triage/types.ts — Types des objets JSON renvoyés par `/lead/:id` et
 * `/lead/:id/dossier`, tels que documentés par la skill `paragone`
 * (lead.taint : sink/sources/findings, dossier.classes : scores/reasons/
 * guidance/definition par classe). Couvre les champs effectivement lus
 * par `Dossier.tsx`/`useTriage.ts` -- pas un schéma OpenAPI complet.
 */
import type { Finding, Span } from "./codeSteps";

export type Judgement = {
  class: string;
  score: string;
  confidence?: number;
  reject_reason?: string | null;
  probabilities?: Record<string, number>;
  model?: string;
  note?: string | null;
};

export type TaintNode = {
  verdict?: string;
  findings: Finding[];
  omitted?: Record<string, number>;
};

export type Lead = {
  id: number;
  classes: string[];
  judgements: Judgement[];
  human_score?: string | null;
  human_note?: string | null;
  analyzer: string;
  match_text: string;
  pattern?: string | null;
  reconstructed?: string | null;
  file: string;
  line: number;
  column: number;
  lead: {
    taint?: TaintNode;
    slot?: { kind: string; index?: number; key?: string };
    request?: { method?: string; options?: Record<string, unknown> };
  };
};

export type ClassFrame = {
  cls: string;
  scores?: Record<string, string>;
  reasons?: Record<string, string>;
  guidance?: string;
  definition?: string;
  caseText?: string;
};

export type DossierData = {
  classes: ClassFrame[];
  verdictLegend?: string;
  endKindLegend?: Record<string, string>;
  analyzerName: string;
  references: { url: string; label: string }[];
};

export type Duplicate = { id: number; file: string; line: number };

export type Source = { text: string; targetLine: number };

export type Vocabulary = {
  impactClasses: string[];
  inventoryClasses: string[];
  languages: string[];
};

export type Summary = {
  totals: { total: number; agent_judged: number; human_reviewed: number };
  byClass: { k: string; n: number }[];
  byAnalyzer: { k: string; n: number }[];
  byVerdict: { k: string; n: number }[];
  byAgentScore: { k: string; n: number }[];
};

export type { Finding, Span };
