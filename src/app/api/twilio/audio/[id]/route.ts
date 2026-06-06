// Serves a pre-generated TTS audio buffer to Twilio's announceUrl fetch.
// Each buffer is consumed once then discarded.

import { NextResponse } from "next/server";
import { popAudio } from "@/lib/twilio";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const buf = popAudio(id);
  if (!buf) {
    return NextResponse.json({ error: "Audio not found." }, { status: 404 });
  }
  return new Response(buf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
