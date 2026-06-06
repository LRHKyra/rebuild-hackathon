// Traces to: Twilio conference bridge for live call integration.
// Vesper joins as a bot participant via conference transcription + audio announce.

import twilio from "twilio";

export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required.");
  }
  return twilio(accountSid, authToken);
}

export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return url.replace(/\/$/, "");
}

// In-memory store for pre-generated TTS audio buffers keyed by UUID.
// Twilio fetches the audio once via GET /api/twilio/audio/[id], then it's removed.
const audioStore = new Map<string, Buffer>();

export function storeAudio(id: string, buffer: Buffer): void {
  audioStore.set(id, buffer);
  // Auto-expire after 60s to avoid leaking memory.
  setTimeout(() => audioStore.delete(id), 60_000);
}

export function popAudio(id: string): Buffer | undefined {
  const buf = audioStore.get(id);
  if (buf) audioStore.delete(id);
  return buf;
}
