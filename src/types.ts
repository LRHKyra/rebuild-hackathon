// Traces to: spec/features/voice-loop.md + spec/product.md (shared types).
// Shared, idea-agnostic types for the voice loop.

// Mirrors the @elevenlabs/react Scribe status, plus our own "error" state used to
// drive the no-voice fallback.
export type VoiceStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "transcribing"
  | "error";

// One line of transcript rendered in the UI. `isFinal` distinguishes a committed
// segment from the in-progress (partial) one.
export type TranscriptLine = {
  id: string;
  text: string;
  isFinal: boolean;
};

// Shape returned by /api/scribe/token on success.
export type ScribeTokenResponse = {
  token: string;
};

// TODO(spec): product.md §Core Flow — the demo's "result" payload.
// Placeholder shape until the product surfaces are built. Replace fields to match
// what the live call workspace needs to show (answer cards, etc.).
export type DemoResult = {
  title: string;
  summary: string;
  details: string[];
};
