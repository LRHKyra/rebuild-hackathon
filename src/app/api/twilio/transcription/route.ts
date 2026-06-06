// Twilio transcription callback — called for each speech segment in the conference.
// Runs the same analysis pipeline as the browser path:
//   wake word → summon Vesper (TTS announced into the conference)
//   question  → build answer card in callState
//   statement → contradiction check

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";
import {
  addTranscriptEvent,
  getCallMemory,
  rememberAnswer,
  rememberCorrection,
  rememberQuestion,
  transcriptWindow,
} from "@/lib/callState";
import { getElevenLabsApiKey, getElevenLabsVoiceId } from "@/lib/env";
import { ensureDemoKnowledge } from "@/lib/fixtures";
import { detectContradiction, detectQuestion, generateAnswer } from "@/lib/llm";
import { retrieve } from "@/lib/retrieval";
import { getStore } from "@/lib/store";
import { getAppUrl, getTwilioClient, storeAudio } from "@/lib/twilio";
import { detectWakeWord } from "@/lib/wakeword";
import type { AnswerCard, CorrectionCard, DetectedQuestion } from "@/types";

export const dynamic = "force-dynamic";

const CALL_ID = "demo-call";
const COMPANY_ID = "demo-company";
const REFUSAL =
  "I do not have that confirmed in the product knowledge base. I would not want to guess.";

export async function POST(request: Request) {
  const formData = await request.formData();
  const text = (formData.get("TranscriptionText") as string | null)?.trim() ?? "";
  const conferenceSid = (formData.get("ConferenceSid") as string | null) ?? "";

  if (!text) return new Response("ok", { status: 200 });

  console.log(`[twilio/transcription] "${text}"`);

  addTranscriptEvent({ callId: CALL_ID, speaker: "unknown", text });
  await ensureDemoKnowledge();

  // Wake word → Vesper speaks the latest answer into the conference.
  if (detectWakeWord(text).matched) {
    void speakIntoConference(conferenceSid).catch((err) =>
      console.error("[twilio/transcription] summon failed:", err),
    );
    return new Response("ok", { status: 200 });
  }

  const window = transcriptWindow(CALL_ID);

  // Question detection → build answer card.
  const questionResult = await detectQuestion({ text, transcriptWindow: window }).catch(
    () => null,
  );
  if (questionResult?.hasQuestion && questionResult.question) {
    const detectedQuestion: DetectedQuestion = {
      id: crypto.randomUUID(),
      callId: CALL_ID,
      question: questionResult.question,
      speaker: "unknown",
      transcriptWindow: window,
      status: "new",
      category: questionResult.category,
      createdAt: new Date().toISOString(),
    };
    rememberQuestion(detectedQuestion);
    const answerCard = await buildAnswerCard(detectedQuestion.id, detectedQuestion.question, window);
    rememberAnswer(answerCard);
  }

  // Contradiction check on rep statements.
  if (looksLikeFactStatement(text)) {
    const cards = await getStore().list(COMPANY_ID);
    const contradiction = await detectContradiction({ statement: text, cards }).catch(
      () => null,
    );
    if (
      contradiction?.hasContradiction &&
      contradiction.issue &&
      contradiction.suggestedCorrection
    ) {
      const correctionCard: CorrectionCard = {
        id: crypto.randomUUID(),
        callId: CALL_ID,
        repStatement: contradiction.repStatement ?? text,
        issue: contradiction.issue,
        suggestedCorrection: contradiction.suggestedCorrection,
        sourceCardIds: contradiction.sourceCardIds ?? [],
        severity: contradiction.severity ?? "medium",
        createdAt: new Date().toISOString(),
      };
      rememberCorrection(correctionCard);
    }
  }

  return new Response("ok", { status: 200 });
}

// Synthesize Vesper's latest answer and announce it into the Twilio conference.
async function speakIntoConference(conferenceSid: string): Promise<void> {
  const memory = getCallMemory(CALL_ID);
  const answerText =
    memory.latestAnswer?.canSpeak && memory.latestAnswer.answer
      ? memory.latestAnswer.answer
      : REFUSAL;

  // Synthesize with ElevenLabs.
  const apiKey = getElevenLabsApiKey();
  const voiceId = getElevenLabsVoiceId();
  const client = new ElevenLabsClient({ apiKey });
  const audioStream = await client.textToSpeech.convert(voiceId, { text: answerText });

  // Buffer the audio and store it for Twilio to fetch.
  const chunks: Uint8Array[] = [];
  const reader = audioStream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const buf = Buffer.alloc(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.length;
  }

  const audioId = crypto.randomUUID();
  storeAudio(audioId, buf);
  const audioUrl = `${getAppUrl()}/api/twilio/audio/${audioId}`;

  // Announce into the conference — all participants hear it.
  if (conferenceSid) {
    const twilioClient = getTwilioClient();
    await twilioClient.conferences(conferenceSid).update({
      announceUrl: audioUrl,
      announceMethod: "GET",
    });
  } else {
    // Fallback: log the URL (useful for local testing without a real conferenceSid).
    console.log(`[twilio/transcription] audio ready at ${audioUrl}`);
  }
}

async function buildAnswerCard(
  questionId: string,
  question: string,
  transcriptContext: string,
): Promise<AnswerCard> {
  const retrieved = await retrieve({ companyId: COMPANY_ID, query: question });
  if (retrieved.length === 0) {
    return {
      id: crypto.randomUUID(),
      callId: CALL_ID,
      questionId,
      answer: REFUSAL,
      sourceCardIds: [],
      confidence: "low",
      canSpeak: false,
      createdAt: new Date().toISOString(),
    };
  }
  const generated = await generateAnswer({
    question,
    transcriptContext,
    cards: retrieved.map((r) => r.card),
  });
  return {
    id: crypto.randomUUID(),
    callId: CALL_ID,
    questionId,
    answer: generated.answer,
    sourceCardIds: generated.sourceCardIds,
    confidence: generated.confidence,
    canSpeak: generated.canSpeak && generated.confidence !== "low",
    createdAt: new Date().toISOString(),
  };
}

function looksLikeFactStatement(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    !/[?？]\s*$/.test(text) &&
    /\b(scim|sso|hipaa|soc|salesforce|hubspot|workday|implementation|retention|on-prem|enterprise|saml|oauth|gdpr|api|pricing|availability|support|tier|contract|deployment)\b/.test(lower)
  );
}
