// Traces to: spec/product.md §12 (Question Detector prompt) + workstreams.md Lane A.
//
// ── STUB (frozen interface) ─────────────────────────────────────────────────
// A parallel agent replaces ONLY the body of `detectQuestion` with a real Claude
// call (model MODELS.detect = Haiku 4.5) using `callStructured` from ./client and
// the §12 Question Detector prompt + a single tool whose input_schema matches
// DetectQuestionResult. Until then this is a cheap heuristic so the app runs offline.
// Do not change the exported types or signature.

import type { QuestionCategory, Urgency } from "@/types";

export type DetectQuestionInput = {
  // The latest transcript text to inspect.
  text: string;
  // Optional surrounding transcript for context.
  transcriptWindow?: string;
};

export type DetectQuestionResult = {
  hasQuestion: boolean;
  question?: string;
  category?: QuestionCategory;
  urgency?: Urgency;
};

// AGENT: replace this body with a Claude (Haiku) forced-tool call per §12.
export async function detectQuestion(
  input: DetectQuestionInput,
): Promise<DetectQuestionResult> {
  const text = input.text.trim();
  if (text.includes("?")) {
    return { hasQuestion: true, question: text, category: "other", urgency: "medium" };
  }
  return { hasQuestion: false };
}
