// Traces to: spec/product.md §8 (knowledge model) + §13 (contracts) and
// spec/features/voice-loop.md. Shared types — the seams between lanes. Lane A owns
// this file; other lanes import from it. Announce changes (workstreams.md).

// ── Voice loop (idea-agnostic) ──────────────────────────────────────────────

export type VoiceStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "transcribing"
  | "error";

export type TranscriptLine = {
  id: string;
  text: string;
  isFinal: boolean;
};

export type ScribeTokenResponse = {
  token: string;
};

// ── Knowledge & call model (product.md §8) ──────────────────────────────────

export type QuestionCategory =
  | "security"
  | "integration"
  | "implementation"
  | "pricing"
  | "product"
  | "compliance"
  | "other";

export type Urgency = "low" | "medium" | "high";
export type Confidence = "high" | "medium" | "low";
export type Severity = "low" | "medium" | "high";
export type Speaker = "prospect" | "rep" | "unknown";

export type KnowledgeCard = {
  id: string;
  companyId: string;
  title: string;
  source: string;
  topicTags: string[];
  text: string;
  embedding?: number[];
  createdAt: string;
};

export type DetectedQuestion = {
  id: string;
  callId: string;
  question: string;
  speaker: Speaker;
  transcriptWindow: string;
  status: "new" | "answered" | "ignored";
  category?: QuestionCategory;
  createdAt: string;
};

export type AnswerCard = {
  id: string;
  callId: string;
  questionId: string;
  // Rich, scannable answer for the private panel (markdown ok).
  answer: string;
  // Short, natural, no-markdown version for TTS (what Vesper says aloud).
  spokenAnswer: string;
  sourceCardIds: string[];
  confidence: Confidence;
  canSpeak: boolean;
  createdAt: string;
};

export type CorrectionCard = {
  id: string;
  callId: string;
  repStatement: string;
  issue: string;
  suggestedCorrection: string;
  sourceCardIds: string[];
  severity: Severity;
  createdAt: string;
};

// A knowledge card with its similarity score from retrieval.
export type RetrievedCard = {
  card: KnowledgeCard;
  score: number;
};

// Optional observability payload, attached only when ?debug=1 (or LLM_DEBUG=1).
// Lets call-sim --verbose show the actual LLM I/O. Loose types on purpose.
export type TranscriptDebug = {
  detect?: unknown;
  retrieved?: { id: string; title: string; score: number }[];
  answer?: unknown;
  contradiction?: unknown;
  gating?: unknown;
};

// Response shape of POST /api/call/transcript — the big seam (Lane B → Lane C).
export type TranscriptAnalysis = {
  detectedQuestion?: DetectedQuestion | null;
  answerCard?: AnswerCard | null;
  correctionCard?: CorrectionCard | null;
  // True when this line summoned Vesper by name (wake word).
  isWake?: boolean;
  // On a wake line, the latest speakable answer that should be spoken aloud.
  summon?: AnswerCard | null;
  // Present only in debug mode.
  debug?: TranscriptDebug;
};

// ── Product placeholder (Lane C) ────────────────────────────────────────────
// TODO(spec): product.md §6B — superseded by AnswerCard/CorrectionCard in the
// real workspace; kept until the panel UI lands.
export type DemoResult = {
  title: string;
  summary: string;
  details: string[];
};
