// Traces to: spec/features/voice-loop.md — client helpers for the voice loop.
//
// Client-safe: NO secrets here. These only call our own server routes, which are
// the single place allowed to talk to ElevenLabs with the API key.

import type { ScribeTokenResponse } from "@/types";

const SCRIBE_TOKEN_ENDPOINT = "/api/scribe/token";
const TTS_ENDPOINT = "/api/tts";

// Fetches a short-lived, single-use Scribe realtime token from our server route.
// Call this right before connecting (tokens expire ~15 min). Throws Error with a
// user-friendly message on failure.
export async function fetchScribeToken(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(SCRIBE_TOKEN_ENDPOINT, { cache: "no-store" });
  } catch {
    throw new Error("Network error: could not reach the voice service.");
  }

  if (!response.ok) {
    throw new Error(await safeErrorMessage(response));
  }

  const data = (await response.json()) as Partial<ScribeTokenResponse>;
  if (!data?.token) {
    throw new Error("Voice service returned an invalid token response.");
  }
  return data.token;
}

// Sends text to our TTS route and returns the synthesized audio as a Blob the
// caller can play. The text is decided by the caller (an ad-hoc grounded answer
// in the real product).
export async function synthesizeSpeech(text: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(TTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new Error("Network error: could not reach the voice service.");
  }

  if (!response.ok) {
    throw new Error(await safeErrorMessage(response));
  }
  return response.blob();
}

// Best-effort extraction of an { error } message; falls back to a status string.
async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // ignore parse errors (e.g. a non-JSON body)
  }
  return `Voice service unavailable (status ${response.status}).`;
}
