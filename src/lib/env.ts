// Traces to: spec/principles.md §Secrets — "Validate env at request time inside
// the route, not at import/build time, so builds and CI never need real secrets."
//
// IMPORTANT: do not read these at module top-level. Call the getters inside a
// request handler so a missing key fails the request, not the build.

// Thrown when a required server-side secret is missing at request time.
export class MissingEnvError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing required environment variable(s): ${missing.join(", ")}`);
    this.name = "MissingEnvError";
  }
}

// Reads a required server-only env var, throwing MissingEnvError if absent.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new MissingEnvError([name]);
  return value;
}

// ElevenLabs key — used to mint Scribe tokens and call TTS. Server-only.
export function getElevenLabsApiKey(): string {
  return requireEnv("ELEVENLABS_API_KEY");
}

// The voice Vesper speaks with (TTS). Server-only.
export function getElevenLabsVoiceId(): string {
  return requireEnv("ELEVENLABS_VOICE_ID");
}

// LLM provider key — question detection, grounded answering, contradiction.
// Server-only. (Used by the product routes, not the bare voice loop.)
export function getLlmApiKey(): string {
  return requireEnv("LLM_API_KEY");
}
