// Traces to: spec/features/voice-loop.md (TTS out) + spec/principles.md §Secrets.
//
// Server-only. Synthesizes a GIVEN string to speech with ElevenLabs and streams
// the audio back as audio/mpeg. The text is supplied by the caller (in the real
// product, an ad-hoc LLM-generated grounded answer) — this route does NOT decide
// what to say. Reads env at request time; never returns a key.
//
// Verified against installed @elevenlabs/elevenlabs-js:
//   client.textToSpeech.convert(voiceId, { text }) -> ReadableStream<Uint8Array>

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";
import {
  getElevenLabsApiKey,
  getElevenLabsVoiceId,
  MissingEnvError,
} from "@/lib/env";

export const dynamic = "force-dynamic";

// Guardrail: spoken answers are short (spec: < ~75 words). Cap input length.
const MAX_TEXT_LENGTH = 5000;

// Deterministic safety net: callers may pass markdown, but TTS must never read
// literal markup aloud (e.g. "asterisk asterisk", "hash", "backtick"). This
// strips/cleans common markdown so it sounds natural when spoken. Conservative
// by design: it must not mangle ordinary punctuation, numbers, currency, or
// hyphenated words mid-sentence.
function stripMarkdownForSpeech(text: string): string {
  return (
    text
      // Links: [label](url) -> label
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // Inline code / code fences: drop backticks, keep contents.
      .replace(/`+/g, "")
      // Process line-by-line for line-anchored markers (headings, bullets, quotes).
      .split("\n")
      .map((line) => {
        let out = line;
        // Blockquote markers at line start (one or more ">").
        out = out.replace(/^\s*>+\s?/, "");
        // Heading hashes at line start ("#", "##", ...).
        out = out.replace(/^\s*#{1,6}\s+/, "");
        // Unordered list bullets at line start: -, *, • (require trailing space
        // so we don't eat a leading hyphen of a hyphenated/negative token).
        out = out.replace(/^\s*[-*•]\s+/, "");
        // Ordered list markers at line start: "1." / "2)" etc. (require space).
        out = out.replace(/^\s*\d+[.)]\s+/, "");
        return out;
      })
      .join("\n")
      // Bold/italic markers. Asterisks: only when wrapping content (paired) so
      // standalone "*" or arithmetic "2 * 3" stays intact.
      .replace(/\*{1,3}(\S(?:.*?\S)?)\*{1,3}/g, "$1")
      // Underscores used for emphasis: require word boundaries so snake_case
      // identifiers and mid-word underscores are left alone.
      .replace(/(^|[\s(])_{1,3}(\S(?:.*?\S)?)_{1,3}(?=[\s).,!?;:]|$)/g, "$1$2")
      // Collapse 3+ newlines down to a single paragraph break.
      .replace(/\n{3,}/g, "\n\n")
      // Collapse runs of spaces/tabs into a single space.
      .replace(/[ \t]{2,}/g, " ")
      // Trim trailing spaces on each line.
      .replace(/[ \t]+\n/g, "\n")
      .trim()
  );
}

export async function POST(request: Request) {
  // Validate the request body at the boundary.
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text =
    typeof (payload as { text?: unknown })?.text === "string"
      ? (payload as { text: string }).text.trim()
      : "";

  if (!text) {
    return NextResponse.json(
      { error: "`text` is required." },
      { status: 400 },
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `\`text\` exceeds ${MAX_TEXT_LENGTH} characters.` },
      { status: 413 },
    );
  }

  let apiKey: string;
  let voiceId: string;
  try {
    apiKey = getElevenLabsApiKey();
    voiceId = getElevenLabsVoiceId();
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error("[tts] missing env:", error.missing.join(", "));
      return NextResponse.json(
        { error: "Voice is not configured on the server." },
        { status: 503 },
      );
    }
    throw error;
  }

  try {
    const client = new ElevenLabsClient({ apiKey });
    const spokenText = stripMarkdownForSpeech(text);
    const audioStream = await client.textToSpeech.convert(voiceId, {
      text: spokenText,
    });
    const audio = await streamToArrayBuffer(audioStream);

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[tts] synthesis failed:", error);
    return NextResponse.json(
      { error: "Could not synthesize speech. Please try again." },
      { status: 502 },
    );
  }
}

// Buffers a web ReadableStream into a single ArrayBuffer. Spoken answers are small
// (tens of KB), so buffering is simpler and more robust than piping.
async function streamToArrayBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out.buffer;
}
