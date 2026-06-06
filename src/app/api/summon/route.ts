// Traces to: spec/product.md §13 (POST /api/summon) + §11 Summoned Mode and
// workstreams.md Lane B. This route speaks only after a wake phrase and only if
// the latest grounded answer is safe to say aloud.

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";
import { getCallMemory, rememberAnswer, transcriptWindow } from "@/lib/callState";
import {
  getElevenLabsApiKey,
  getElevenLabsVoiceId,
  MissingEnvError,
} from "@/lib/env";
import { generateAnswer } from "@/lib/llm";
import { retrieve } from "@/lib/retrieval";
import { detectWakeWord } from "@/lib/wakeword";
import type { AnswerCard } from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_CALL = "demo-call";
const DEFAULT_COMPANY = "demo-company";
const UNSUPPORTED_SPOKEN =
  "I do not have that confirmed in the product knowledge base. I would not want to guess.";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const wakePhrase =
    typeof body.wakePhrase === "string" ? body.wakePhrase.trim() : "";
  if (!wakePhrase) {
    return NextResponse.json(
      { error: "`wakePhrase` is required." },
      { status: 400 },
    );
  }

  const wake = detectWakeWord(wakePhrase);
  if (!wake.matched) {
    return NextResponse.json(
      { error: "Wake phrase did not summon Vesper." },
      { status: 400 },
    );
  }

  const callId =
    typeof body.callId === "string" && body.callId.trim()
      ? body.callId.trim()
      : DEFAULT_CALL;
  const companyId =
    typeof body.companyId === "string" && body.companyId.trim()
      ? body.companyId.trim()
      : DEFAULT_COMPANY;

  let latestAnswer: AnswerCard | undefined;
  try {
    latestAnswer = await answerForSummon({ callId, companyId });
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error("[summon] missing env:", error.missing.join(", "));
      return NextResponse.json(
        { error: "Summoned answer is not configured on the server." },
        { status: 503 },
      );
    }

    console.error("[summon] answer generation failed:", error);
    return NextResponse.json(
      { error: "Could not prepare a summoned answer. Please try again." },
      { status: 502 },
    );
  }

  const spokenText =
    latestAnswer?.canSpeak && latestAnswer.answer
      ? toSpokenAnswer(latestAnswer.answer)
      : UNSUPPORTED_SPOKEN;

  let apiKey: string;
  let voiceId: string;
  try {
    apiKey = getElevenLabsApiKey();
    voiceId = getElevenLabsVoiceId();
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error("[summon] missing env:", error.missing.join(", "));
      return NextResponse.json(
        { error: "Voice is not configured on the server." },
        { status: 503 },
      );
    }
    throw error;
  }

  try {
    const client = new ElevenLabsClient({ apiKey });
    const audioStream = await client.textToSpeech.convert(voiceId, {
      text: spokenText,
    });
    const audio = await streamToArrayBuffer(audioStream);

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Vesper-Spoken-Text": encodeURIComponent(spokenText),
        "X-Vesper-Source-Card-Ids": latestAnswer?.sourceCardIds.join(",") ?? "",
      },
    });
  } catch (error) {
    console.error("[summon] synthesis failed:", error);
    return NextResponse.json(
      { error: "Could not synthesize summoned answer. Please try again." },
      { status: 502 },
    );
  }
}

async function answerForSummon(params: {
  callId: string;
  companyId: string;
}): Promise<AnswerCard | undefined> {
  const memory = getCallMemory(params.callId);
  const question = memory.latestQuestion;
  if (!question) return memory.latestAnswer;

  // Fast path for live calls: the transcript route precomputes the answer as soon
  // as it detects a question. When Vesper is summoned, speak that prepared answer
  // instead of making the room wait for another retrieval + LLM round trip.
  if (
    memory.latestAnswer &&
    memory.latestAnswer.questionId === question.id &&
    memory.latestAnswer.canSpeak
  ) {
    return memory.latestAnswer;
  }

  const createdAt = new Date().toISOString();
  const retrieved = await retrieve({
    companyId: params.companyId,
    query: question.question,
  });

  if (retrieved.length === 0) {
    const refusal: AnswerCard = {
      id: crypto.randomUUID(),
      callId: params.callId,
      questionId: question.id,
      answer: UNSUPPORTED_SPOKEN,
      sourceCardIds: [],
      confidence: "low",
      canSpeak: false,
      createdAt,
    };
    rememberAnswer(refusal);
    return refusal;
  }

  const generated = await generateAnswer({
    question: question.question,
    transcriptContext: transcriptWindow(params.callId),
    cards: retrieved.map((result) => result.card),
  });

  const answer: AnswerCard = {
    id: crypto.randomUUID(),
    callId: params.callId,
    questionId: question.id,
    answer: generated.answer,
    sourceCardIds: generated.sourceCardIds,
    confidence: generated.confidence,
    canSpeak: generated.canSpeak && generated.confidence !== "low",
    createdAt,
  };
  rememberAnswer(answer);
  return answer;
}

function toSpokenAnswer(answer: string): string {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 75).join(" ");
}

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
