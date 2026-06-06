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
import { callStructured, MODELS } from "./client";

const REFUSAL =
  "I do not have that confirmed in the product knowledge base. I would not want to guess.";

const SYSTEM =
  "You are Vesper, a company-specific expert assistant. Answer only using the provided knowledge cards. If the answer is not supported, say you cannot confirm from the knowledge base. " +
  "Produce TWO registers of the same answer (same facts, different form):\n" +
  "1) answer = the PANEL text the rep silently reads. Rich and scannable; markdown is allowed; you may include an honest boundary or caveat.\n" +
  "2) spokenAnswer = what Vesper SAYS ALOUD to the customer once summoned (§11/§12 Spoken Answer). Natural and confident, under 75 words, NO markdown (no *, **, #, bullets, or lists), plain spoken sentences only. Do NOT cite sources or say \"according to\" / \"the docs say\". Do NOT ask follow-up questions. Just speak the answer to the customer.\n" +
  "Keep both consistent with the same underlying facts.";

export type GenerateAnswerInput = {
  question: string;
  transcriptContext?: string;
  // The retrieved knowledge cards to ground the answer in.
  cards: KnowledgeCard[];
};

export type GenerateAnswerResult = {
  answer: string;
  spokenAnswer: string;
  confidence: Confidence;
  sourceCardIds: string[];
  canSpeak: boolean;
};

// Grounded answer via a Sonnet forced-tool call (§12). Answer ONLY from the
// provided cards; cite their ids; confidence is the single source of truth (§10B).
export async function generateAnswer(
  input: GenerateAnswerInput,
): Promise<GenerateAnswerResult> {
  // No cards → refuse (§10A). The route short-circuits this, but keep it safe.
  if (input.cards.length === 0) {
    return {
      answer: REFUSAL,
      spokenAnswer: REFUSAL,
      confidence: "low",
      sourceCardIds: [],
      canSpeak: false,
    };
  }

  const cardList = input.cards
    .map((c) => `[${c.id}] ${c.title}: ${c.text}`)
    .join("\n\n");

  const transcriptBlock = input.transcriptContext
    ? `Transcript context:\n${input.transcriptContext}\n\n`
    : "";

  const userText =
    `Customer question:\n${input.question}\n\n` +
    transcriptBlock +
    `Knowledge cards:\n${cardList}\n\n` +
    "Answer the customer question using only the knowledge cards above. " +
    "Return TWO registers: answer = the rich, scannable panel text the rep reads (markdown ok, may include an honest boundary/caveat); " +
    "spokenAnswer = what Vesper says aloud — natural, confident, under 75 words, no markdown, no source citations, no follow-up questions. " +
    "Keep both consistent (same facts). " +
    "Cite the ids of the cards you used in sourceCardIds. " +
    "Set confidence to high if a card directly answers, medium if partial, low if not clearly answered.";

  return callStructured<GenerateAnswerResult>({
    model: MODELS.answer,
    system: SYSTEM,
    cacheSystem: true,
    messages: [{ role: "user", content: userText }],
    tool: {
      name: "submit_answer",
      description:
        "Submit the grounded answer to the customer question based only on the provided knowledge cards.",
      input_schema: {
        type: "object",
        properties: {
          answer: {
            type: "string",
            description:
              "PANEL text the rep silently reads: rich, scannable, grounded answer (markdown allowed; may include an honest boundary/caveat), or a statement that it cannot be confirmed from the knowledge base.",
          },
          spokenAnswer: {
            type: "string",
            description:
              "What Vesper SAYS ALOUD to the customer: natural, confident, under 75 words, NO markdown (no *, **, #, bullets, or lists), do NOT cite sources or say 'according to'/'the docs say', no follow-up questions. Same facts as answer, spoken register.",
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
            description:
              "high = a card directly answers; medium = partial; low = not clearly answered.",
          },
          sourceCardIds: {
            type: "array",
            items: { type: "string" },
            description: "Ids of the knowledge cards used to support the answer.",
          },
          canSpeak: {
            type: "boolean",
            description: "Whether this answer is safe to speak aloud (only high/medium).",
          },
        },
        required: ["answer", "spokenAnswer", "confidence", "sourceCardIds", "canSpeak"],
      },
    },
  });
}
