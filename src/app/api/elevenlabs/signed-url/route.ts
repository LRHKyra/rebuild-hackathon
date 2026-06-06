// Traces to: spec/features/voice-loop.md (signed URL) + spec/principles.md §Secrets.
//
// Server-only route. Reads env at request time, asks ElevenLabs for a short-lived
// signed WebSocket URL, and returns ONLY { signedUrl } to the client. The API key
// and agent ID never leave the server.
//
// Verified against current ElevenLabs SDK (@elevenlabs/elevenlabs-js):
//   client.conversationalAi.conversations.getSignedUrl({ agentId }) -> { signedUrl }

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";
import { getServerEnv, MissingEnvError } from "@/lib/env";
import type { SignedUrlResponse } from "@/types";

// Signed URLs are short-lived; never cache this route.
export const dynamic = "force-dynamic";

export async function GET() {
  let env;
  try {
    env = getServerEnv();
  } catch (error) {
    if (error instanceof MissingEnvError) {
      // Configuration problem, not a client error. Don't leak which is set.
      console.error("[signed-url] missing env:", error.missing.join(", "));
      return NextResponse.json(
        { error: "Voice is not configured on the server." },
        { status: 503 },
      );
    }
    throw error;
  }

  try {
    const client = new ElevenLabsClient({ apiKey: env.elevenLabsApiKey });

    const { signedUrl } = await client.conversationalAi.conversations.getSignedUrl({
      agentId: env.elevenLabsAgentId,
    });

    const body: SignedUrlResponse = { signedUrl };
    return NextResponse.json(body);
  } catch (error) {
    // Log full detail server-side; return a generic message to the client.
    console.error("[signed-url] failed to mint signed URL:", error);
    return NextResponse.json(
      { error: "Could not start a voice session. Please try again." },
      { status: 502 },
    );
  }
}
