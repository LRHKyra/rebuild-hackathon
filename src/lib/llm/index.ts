// Traces to: workstreams.md Lane A — single import surface for the LLM functions.

export { detectQuestion } from "./detectQuestion";
export type { DetectQuestionInput, DetectQuestionResult } from "./detectQuestion";

export { generateAnswer } from "./generateAnswer";
export type { GenerateAnswerInput, GenerateAnswerResult } from "./generateAnswer";

export { detectContradiction } from "./detectContradiction";
export type {
  DetectContradictionInput,
  DetectContradictionResult,
} from "./detectContradiction";

export { MODELS } from "./client";
