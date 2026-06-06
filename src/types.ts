// Traces to: spec/features/voice-loop.md + spec/product.md (shared types).
// Shared, idea-agnostic types used across the voice loop and demo shell.

// Roles in a conversation. The ElevenLabs SDK reports "user" | "agent".
export type TranscriptRole = "user" | "agent";

// One line of transcript rendered in the UI.
// `id` is a stable client-side key for React lists.
export type TranscriptMessage = {
  id: string;
  role: TranscriptRole;
  text: string;
};

// Mirrors the @elevenlabs/react conversation status, which already collapses
// connection failures into an "error" state we use to drive the no-voice fallback.
export type VoiceStatus = "disconnected" | "connecting" | "connected" | "error";

// Shape returned by /api/elevenlabs/signed-url on success.
export type SignedUrlResponse = {
  signedUrl: string;
};

// TODO(spec): product.md §Core Flow — the demo's "result" payload.
// Placeholder shape until product.md is filled in. Replace fields to match
// whatever the chosen product idea needs to show the judge.
export type DemoResult = {
  title: string;
  summary: string;
  details: string[];
};
