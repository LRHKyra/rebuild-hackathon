// Twilio webhook — called when someone dials the Twilio number.
// Puts the caller into the "vesper-demo" conference and enables real-time
// transcription so Vesper can listen and react to the wake word.

import { NextResponse } from "next/server";
import twilio from "twilio";
import { getAppUrl } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const { VoiceResponse } = twilio.twiml;

export async function POST() {
  const appUrl = getAppUrl();
  const response = new VoiceResponse();
  const dial = response.dial();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (dial.conference as any)("vesper-demo", {
    transcribe: true,
    transcriptionCallback: `${appUrl}/api/twilio/transcription`,
    startConferenceOnEnter: true,
    endConferenceOnExit: false,
    muted: false,
    record: "do-not-record",
  });

  return new Response(response.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
