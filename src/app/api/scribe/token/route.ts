// Traces to: spec/features/voice-loop.md (STT token) + spec/principles.md §Secrets.
//
// Server-only. Mints a short-lived, single-use Scribe realtime token for the
// browser so the client can open the Scribe WebSocket WITHOUT ever holding the
// API key. Reads env at request time.
//
// Verified against installed @elevenlabs/elevenlabs-js:
//   client.tokens.singleUse.create("realtime_scribe") -> { token } (expires ~15 min)

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";
import { getElevenLabsApiKey, MissingEnvError } from "@/lib/env";
import type { ScribeTokenResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  let apiKey: string;
  try {
    apiKey = getElevenLabsApiKey();
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error("[scribe/token] missing env:", error.missing.join(", "));
      return NextResponse.json(
        { error: "Voice is not configured on the server." },
        { status: 503 },
      );
    }
    throw error;
  }

  try {
    const client = new ElevenLabsClient({ apiKey });
    const { token } = await client.tokens.singleUse.create("realtime_scribe");
    const body: ScribeTokenResponse = { token };
    return NextResponse.json(body);
  } catch (error) {
    console.error("[scribe/token] failed to mint token:", error);
    return NextResponse.json(
      { error: "Could not start transcription. Please try again." },
      { status: 502 },
    );
  }
}
