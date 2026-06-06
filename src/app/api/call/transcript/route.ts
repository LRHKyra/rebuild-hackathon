// Traces to: spec/product.md §13 (POST /api/call/transcript) + workstreams.md
// Lane B. This route is the call pipeline: transcript event in, private Vesper
// analysis out, using Lane A's LLM/retrieval functions through their public APIs.

import { NextResponse } from "next/server";
import {
  addTranscriptEvent,
  rememberAnswer,
  rememberCorrection,
  rememberQuestion,
  transcriptWindow,
} from "@/lib/callState";
import { MissingEnvError } from "@/lib/env";
import { detectContradiction, detectQuestion, generateAnswer } from "@/lib/llm";
import { retrieve } from "@/lib/retrieval";
import { getStore } from "@/lib/store";
import type {
  AnswerCard,
  CorrectionCard,
  DetectedQuestion,
  Speaker,
  TranscriptAnalysis,
} from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_CALL = "demo-call";
const DEFAULT_COMPANY = "demo-company";
const REFUSAL =
  "I do not have that confirmed in the product knowledge base. I would not want to guess.";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "`text` is required." }, { status: 400 });
  }

  const callId = stringOrDefault(body.callId, DEFAULT_CALL);
  const companyId = stringOrDefault(body.companyId, DEFAULT_COMPANY);
  const speaker = parseSpeaker(body.speaker);
  addTranscriptEvent({ callId, speaker, text });

  try {
    const window = transcriptWindow(callId);
    const response: TranscriptAnalysis = {};

    const questionResult = await detectQuestion({
      text,
      transcriptWindow: window,
    });

    if (questionResult.hasQuestion && questionResult.question) {
      const detectedQuestion: DetectedQuestion = {
        id: crypto.randomUUID(),
        callId,
        question: questionResult.question,
        speaker,
        transcriptWindow: window,
        status: "new",
        category: questionResult.category,
        createdAt: new Date().toISOString(),
      };
      rememberQuestion(detectedQuestion);
      response.detectedQuestion = detectedQuestion;

      const answerCard = await buildAnswerCard({
        callId,
        companyId,
        questionId: detectedQuestion.id,
        question: detectedQuestion.question,
        transcriptContext: window,
      });
      rememberAnswer(answerCard);
      response.answerCard = answerCard;
    }

    if ((speaker === "rep" || speaker === "unknown") && looksLikeFactStatement(text)) {
      const cards = await getStore().list(companyId);
      const contradiction = await detectContradiction({
        statement: text,
        cards,
      });

      if (
        contradiction.hasContradiction &&
        contradiction.issue &&
        contradiction.suggestedCorrection
      ) {
        const correctionCard: CorrectionCard = {
          id: crypto.randomUUID(),
          callId,
          repStatement: contradiction.repStatement ?? text,
          issue: contradiction.issue,
          suggestedCorrection: contradiction.suggestedCorrection,
          sourceCardIds: contradiction.sourceCardIds ?? [],
          severity: contradiction.severity ?? "medium",
          createdAt: new Date().toISOString(),
        };
        rememberCorrection(correctionCard);
        response.correctionCard = correctionCard;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error("[call/transcript] missing env:", error.missing.join(", "));
      return NextResponse.json(
        { error: "Call analysis is not configured on the server." },
        { status: 503 },
      );
    }

    console.error("[call/transcript] analysis failed:", error);
    return NextResponse.json(
      { error: "Could not analyze transcript. Please try again." },
      { status: 502 },
    );
  }
}

async function buildAnswerCard(params: {
  callId: string;
  companyId: string;
  questionId: string;
  question: string;
  transcriptContext: string;
}): Promise<AnswerCard> {
  const createdAt = new Date().toISOString();
  const retrieved = await retrieve({
    companyId: params.companyId,
    query: params.question,
  });

  if (retrieved.length === 0) {
    return {
      id: crypto.randomUUID(),
      callId: params.callId,
      questionId: params.questionId,
      answer: REFUSAL,
      sourceCardIds: [],
      confidence: "low",
      canSpeak: false,
      createdAt,
    };
  }

  const generated = await generateAnswer({
    question: params.question,
    transcriptContext: params.transcriptContext,
    cards: retrieved.map((result) => result.card),
  });

  return {
    id: crypto.randomUUID(),
    callId: params.callId,
    questionId: params.questionId,
    answer: generated.answer,
    sourceCardIds: generated.sourceCardIds,
    confidence: generated.confidence,
    canSpeak: generated.canSpeak && generated.confidence !== "low",
    createdAt,
  };
}

function parseSpeaker(value: unknown): Speaker {
  return value === "rep" || value === "prospect" || value === "unknown"
    ? value
    : "unknown";
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function looksLikeFactStatement(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    !/[?？]\s*$/.test(text) &&
    /\b(we|our|it|this|that|scim|sso|hipaa|soc|salesforce|hubspot|workday|implementation|retention|on-prem|enterprise)\b/.test(
      lower,
    )
  );
}
