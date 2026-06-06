// Traces to: spec/product.md §13 (call transcript + summon contracts) and
// workstreams.md Lane B. This is demo-scale server memory so separate routes can
// share the latest call context inside one Next.js server instance.

import type {
  AnswerCard,
  CorrectionCard,
  DetectedQuestion,
  Speaker,
} from "@/types";

export type TranscriptEvent = {
  id: string;
  callId: string;
  speaker: Speaker;
  text: string;
  createdAt: string;
};

export type CallMemory = {
  transcript: TranscriptEvent[];
  latestQuestion?: DetectedQuestion;
  latestAnswer?: AnswerCard;
  latestCorrection?: CorrectionCard;
};

const MAX_TRANSCRIPT_EVENTS = 24;
const calls = new Map<string, CallMemory>();

export function getCallMemory(callId: string): CallMemory {
  const existing = calls.get(callId);
  if (existing) return existing;

  const memory: CallMemory = { transcript: [] };
  calls.set(callId, memory);
  return memory;
}

export function addTranscriptEvent(params: {
  callId: string;
  speaker: Speaker;
  text: string;
}): TranscriptEvent {
  const memory = getCallMemory(params.callId);
  const event: TranscriptEvent = {
    id: crypto.randomUUID(),
    callId: params.callId,
    speaker: params.speaker,
    text: params.text,
    createdAt: new Date().toISOString(),
  };

  memory.transcript = [...memory.transcript, event].slice(-MAX_TRANSCRIPT_EVENTS);
  return event;
}

export function transcriptWindow(callId: string, maxChars = 4000): string {
  const memory = getCallMemory(callId);
  const lines = memory.transcript.map(
    (event) => `${event.speaker}: ${event.text}`,
  );

  let window = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    const next = window ? `${lines[i]}\n${window}` : lines[i];
    if (next.length > maxChars) break;
    window = next;
  }
  return window;
}

export function rememberQuestion(question: DetectedQuestion) {
  getCallMemory(question.callId).latestQuestion = question;
}

export function rememberAnswer(answer: AnswerCard) {
  getCallMemory(answer.callId).latestAnswer = answer;
}

export function rememberCorrection(correction: CorrectionCard) {
  getCallMemory(correction.callId).latestCorrection = correction;
}
