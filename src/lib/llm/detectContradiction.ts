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
import { callStructured, MODELS } from "./client";

const SYSTEM_PROMPT =
  "You are privately assisting a sales rep during a live call. Detect only " +
  "clear factual contradictions between what the rep said and the provided " +
  "knowledge cards. Do not nitpick wording. Do not flag subjective claims.";

const REPORT_TOOL = {
  name: "report_contradiction",
  description:
    "Report whether the rep's statement clearly contradicts the knowledge cards.",
  input_schema: {
    type: "object" as const,
    properties: {
      hasContradiction: {
        type: "boolean",
        description: "True only if there is a clear factual contradiction.",
      },
      repStatement: {
        type: "string",
        description: "The rep's statement that is contradicted.",
      },
      issue: {
        type: "string",
        description: "What the rep got wrong, stated plainly.",
      },
      suggestedCorrection: {
        type: "string",
        description: "A short correction the rep can use.",
      },
      severity: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "How serious the contradiction is.",
      },
      sourceCardIds: {
        type: "array",
        items: { type: "string" },
        description: "IDs of the knowledge cards that establish the fact.",
      },
    },
    required: ["hasContradiction"],
  },
};

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

// Forces Claude (Haiku) to call the single report_contradiction tool per §12,
// returning a typed DetectContradictionResult. Flags only clear factual
// contradictions vs the provided cards (§10C).
export async function detectContradiction(
  input: DetectContradictionInput,
): Promise<DetectContradictionResult> {
  if (input.cards.length === 0) {
    return { hasContradiction: false };
  }

  const cardsBlock = input.cards
    .map((card: KnowledgeCard) => `[${card.id}] ${card.title}: ${card.text}`)
    .join("\n");

  const userMessage =
    `Rep statement:\n${input.statement}\n\n` +
    `Knowledge cards:\n${cardsBlock}`;

  return callStructured<DetectContradictionResult>({
    model: MODELS.contradiction,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    tool: REPORT_TOOL,
    cacheSystem: true,
  });
}
