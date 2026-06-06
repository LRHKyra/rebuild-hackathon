// Traces to: spec/product.md §12 (Grounded Answer prompt) + §10 (eval) + Lane A.
//
// ── STUB (frozen interface) ─────────────────────────────────────────────────
// A parallel agent replaces ONLY the body of `generateAnswer` with a real Claude
// call (model MODELS.answer = Sonnet 4.6) using `callStructured` from ./client and
// the §12 Grounded Answer prompt + a single tool whose input_schema matches
// GenerateAnswerResult. Rules: answer ONLY from the provided cards; cite their ids
// in sourceCardIds; confidence is the single source of truth (high/medium/low);
// canSpeak must be true only for high/medium (§10B). Do not change the signature.

import type { Confidence, KnowledgeCard } from "@/types";

const REFUSAL =
  "I do not have that confirmed in the product knowledge base. I would not want to guess.";

export type GenerateAnswerInput = {
  question: string;
  transcriptContext?: string;
  // The retrieved knowledge cards to ground the answer in.
  cards: KnowledgeCard[];
};

export type GenerateAnswerResult = {
  answer: string;
  confidence: Confidence;
  sourceCardIds: string[];
  canSpeak: boolean;
};

// AGENT: replace this body with a Claude (Sonnet) forced-tool call per §12.
export async function generateAnswer(
  input: GenerateAnswerInput,
): Promise<GenerateAnswerResult> {
  if (input.cards.length === 0) {
    return { answer: REFUSAL, confidence: "low", sourceCardIds: [], canSpeak: false };
  }
  const top = input.cards[0];
  return {
    answer: `Based on our docs: ${top.text.slice(0, 160)}`,
    confidence: "medium",
    sourceCardIds: input.cards.slice(0, 2).map((c) => c.id),
    canSpeak: true,
  };
}
