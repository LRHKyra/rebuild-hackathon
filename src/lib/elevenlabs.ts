// Traces to: spec/features/voice-loop.md — client helper that fetches a signed URL.
//
// Client-safe: this file holds NO secrets. It only calls our own route, which is
// the single place allowed to talk to ElevenLabs with the API key.

import type { SignedUrlResponse } from "@/types";

const SIGNED_URL_ENDPOINT = "/api/elevenlabs/signed-url";

// Fetches a short-lived signed WebSocket URL from our server route.
// Call this right before starting a session (URLs expire ~15 min).
// Throws Error with a user-friendly message on failure.
export async function fetchSignedUrl(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(SIGNED_URL_ENDPOINT, { cache: "no-store" });
  } catch {
    throw new Error("Network error: could not reach the voice service.");
  }

  if (!response.ok) {
    // Surface the server's user-facing message when present.
    const message = await safeErrorMessage(response);
    throw new Error(message);
  }

  const data = (await response.json()) as Partial<SignedUrlResponse>;
  if (!data?.signedUrl) {
    throw new Error("Voice service returned an invalid response.");
  }

  return data.signedUrl;
}

// Best-effort extraction of an { error } message; falls back to a status string.
async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // ignore parse errors
  }
  return `Voice service unavailable (status ${response.status}).`;
}
