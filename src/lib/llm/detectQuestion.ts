// Traces to: spec/product.md §12 (Question Detector prompt) + workstreams.md Lane A.
//
// ── STUB (frozen interface) ─────────────────────────────────────────────────
// A parallel agent replaces ONLY the body of `detectQuestion` with a real Claude
// call (model MODELS.detect = Haiku 4.5) using `callStructured` from ./client and
// the §12 Question Detector prompt + a single tool whose input_schema matches
// DetectQuestionResult. Until then this is a cheap heuristic so the app runs offline.
// Do not change the exported types or signature.

import type Anthropic from "@anthropic-ai/sdk";
import type { QuestionCategory, Urgency } from "@/types";
import { callStructured, MODELS } from "./client";

// §12 Question Detector system prompt.
const SYSTEM =
  "You are detecting customer questions during a live sales or support call. " +
  "Identify questions that require product, technical, security, integration, " +
  "pricing, implementation, or compliance knowledge. Ignore small talk and " +
  "generic conversation.";

// Single forced tool; its input_schema mirrors DetectQuestionResult.
const REPORT_QUESTION_TOOL: Anthropic.Tool = {
  name: "report_question",
  description:
    "Report whether the latest transcript text contains a customer question " +
    "that requires product, technical, security, integration, pricing, " +
    "implementation, or compliance knowledge.",
  input_schema: {
    type: "object",
    properties: {
      hasQuestion: {
        type: "boolean",
        description: "True if a knowledge-requiring question is present.",
      },
      question: {
        type: "string",
        description: "The detected question, restated clearly.",
      },
      category: {
        type: "string",
        enum: [
          "security",
          "integration",
          "implementation",
          "pricing",
          "product",
          "compliance",
          "other",
        ],
        description: "The knowledge domain the question falls under.",
      },
      urgency: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "How urgently the rep needs an answer to keep the call moving.",
      },
    },
    required: ["hasQuestion"],
  },
};

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

// Detects a knowledge-requiring customer question via a Haiku forced-tool call (§12).
export async function detectQuestion(
  input: DetectQuestionInput,
): Promise<DetectQuestionResult> {
  const userText = input.transcriptWindow
    ? `Recent transcript context (for reference only):\n${input.transcriptWindow}\n\nLatest transcript text to inspect:\n${input.text}`
    : `Latest transcript text to inspect:\n${input.text}`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userText },
  ];

  return callStructured<DetectQuestionResult>({
    model: MODELS.detect,
    system: SYSTEM,
    messages,
    tool: REPORT_QUESTION_TOOL,
    maxTokens: 300,
  });
}
