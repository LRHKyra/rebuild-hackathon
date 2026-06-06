// Traces to: spec/product.md §13 (POST /api/answer) + §9 retrieval + §10 eval + Lane A.
//
// Generates a grounded, ad-hoc AnswerCard for a question: retrieve top cards, then
// answer ONLY from them (refuse if nothing relevant). Confidence is the single
// source of truth; only high/medium answers may be spoken.

import { NextResponse } from "next/server";
import { retrieve } from "@/lib/retrieval";
import { generateAnswer } from "@/lib/llm";
import { MissingEnvError } from "@/lib/env";
import type { AnswerCard } from "@/types";

export const dynamic = "force-dynamic";

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
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json(
      { error: "`question` is required." },
      { status: 400 },
    );
  }
  const callId =
    typeof body.callId === "string" && body.callId.trim()
      ? body.callId.trim()
      : "demo-call";
  const companyId =
    typeof body.companyId === "string" && body.companyId.trim()
      ? body.companyId.trim()
      : DEFAULT_COMPANY;
  const questionId =
    typeof body.questionId === "string" && body.questionId.trim()
      ? body.questionId.trim()
      : `q_${crypto.randomUUID()}`;

  try {
    const retrieved = await retrieve({ companyId, query: question });
    const createdAt = new Date().toISOString();

    // Grounding: no relevant cards -> refuse, no LLM call (§10A).
    if (retrieved.length === 0) {
      const refusal: AnswerCard = {
        id: crypto.randomUUID(),
        callId,
        questionId,
        answer: REFUSAL,
        sourceCardIds: [],
        confidence: "low",
        canSpeak: false,
        createdAt,
      };
      return NextResponse.json(refusal);
    }

    const result = await generateAnswer({
      question,
      cards: retrieved.map((r) => r.card),
    });

    const answerCard: AnswerCard = {
      id: crypto.randomUUID(),
      callId,
      questionId,
      answer: result.answer,
      sourceCardIds: result.sourceCardIds,
      confidence: result.confidence,
      // Enforce: only high/medium may be spoken (§10B).
      canSpeak: result.canSpeak && result.confidence !== "low",
      createdAt,
    };
    return NextResponse.json(answerCard);
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error("[answer] missing env:", error.missing.join(", "));
      return NextResponse.json(
        { error: "Answer service is not configured on the server." },
        { status: 503 },
      );
    }
    console.error("[answer] generation failed:", error);
    return NextResponse.json(
      { error: "Could not generate an answer. Please try again." },
      { status: 502 },
    );
  }
}
