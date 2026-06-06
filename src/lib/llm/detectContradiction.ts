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
  "You are privately assisting a sales rep during a live call. Judge the rep's " +
  "statement on TWO independent dimensions, then call report_contradiction.\n\n" +
  "1) isCheckableClaim: Set true ONLY if the statement is a clear, checkable " +
  "FACTUAL assertion about the product, the company, or its capabilities — " +
  "something that could be verified against documentation. Set false for " +
  "chit-chat, greetings, pleasantries, opinions, subjective views, questions, " +
  "or vague/non-specific statements.\n\n" +
  "2) hasContradiction: Set true ONLY if the statement CLEARLY and confidently " +
  "conflicts with a provided knowledge card — a real, egregious factual conflict " +
  "grounded in the cards, not a difference of wording, nuance, or emphasis. When " +
  "you are unsure, return false. Do not nitpick wording. Do not flag subjective " +
  "claims. Minimize false positives, but do not miss a genuine factual conflict.\n\n" +
  "These two flags are independent. A clear factual claim that is actually " +
  "correct (matches or is consistent with the cards) is isCheckableClaim=true " +
  "and hasContradiction=false. Only ground a contradiction in the cards.";

const REPORT_TOOL = {
  name: "report_contradiction",
  description:
    "Report whether the rep's statement clearly contradicts the knowledge cards.",
  input_schema: {
    type: "object" as const,
    properties: {
      isCheckableClaim: {
        type: "boolean",
        description:
          "True only if the statement is a clear, checkable factual assertion " +
          "about the product, company, or its capabilities — not chit-chat, " +
          "pleasantries, opinions, questions, or vague statements.",
      },
      hasContradiction: {
        type: "boolean",
        description:
          "True only if the statement clearly and confidently conflicts with a " +
          "provided knowledge card (a real factual conflict, not wording, nuance, " +
          "or emphasis). When unsure, false.",
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
    required: ["isCheckableClaim", "hasContradiction"],
  },
};

export type DetectContradictionInput = {
  // A statement (typically the rep's) to check against the knowledge base.
  statement: string;
  // The knowledge cards to check against (pass the relevant KB, §10C).
  cards: KnowledgeCard[];
};

export type DetectContradictionResult = {
  isCheckableClaim: boolean;
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
    return { hasContradiction: false, isCheckableClaim: false };
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
