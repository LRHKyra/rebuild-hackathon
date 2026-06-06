// Traces to: spec/product.md §12 (Contradiction Detector) + §10C + Lane A.
//
// ── STUB (frozen interface) ─────────────────────────────────────────────────
// A parallel agent replaces ONLY the body of `detectContradiction` with a real
// Claude call (model MODELS.contradiction = Haiku 4.5) using `callStructured` from
// ./client and the §12 Contradiction Detector prompt + a single tool whose
// input_schema matches DetectContradictionResult. Flag ONLY clear factual
// contradictions vs the provided cards (§10C) — no nitpicking, no subjective
// claims. Do not change the exported types or signature.

import type { KnowledgeCard, Severity } from "@/types";

export type DetectContradictionInput = {
  // A statement (typically the rep's) to check against the knowledge base.
  statement: string;
  // The knowledge cards to check against (pass the relevant KB, §10C).
  cards: KnowledgeCard[];
};

export type DetectContradictionResult = {
  hasContradiction: boolean;
  repStatement?: string;
  issue?: string;
  suggestedCorrection?: string;
  severity?: Severity;
  sourceCardIds?: string[];
};

// AGENT: replace this body with a Claude (Haiku) forced-tool call per §12.
export async function detectContradiction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  input: DetectContradictionInput,
): Promise<DetectContradictionResult> {
  return { hasContradiction: false };
}
