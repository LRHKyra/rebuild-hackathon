// Traces to: spec/product.md §13 (POST /api/call/transcript) + §6/§10/§11 + plan.
//
// The call-analysis loop = "whisper mode". For each transcript line:
//   - wake word ("Vesper, …")? → return the latest speakable answer to summon.
//   - else a question? → detect → retrieve → grounded answer (or refusal).
//   - else a statement? → check it against the KB for a contradiction.
// Returns TranscriptAnalysis. This is the seam Lane B owns/extends; reference impl.

import { NextResponse } from "next/server";
import { detectWakeWord } from "@/lib/wakeword";
import { retrieve } from "@/lib/retrieval";
import { getStore } from "@/lib/store";
import { detectQuestion, generateAnswer, detectContradiction } from "@/lib/llm";
import { MissingEnvError } from "@/lib/env";
import type {
  AnswerCard,
  CorrectionCard,
  DetectedQuestion,
  Speaker,
  TranscriptAnalysis,
} from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_COMPANY = "demo-company";
const REFUSAL =
  "I do not have that confirmed in the product knowledge base. I would not want to guess.";

// Per-call memory of the latest speakable answer, so a wake-word line (which may
// not itself contain the question) can summon the answer from a prior turn.
// In-process state — fine for the local single-process demo + the driver.
const lastSpeakable = new Map<string, AnswerCard>();

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
  const callId =
    typeof body.callId === "string" && body.callId.trim()
      ? body.callId.trim()
      : "demo-call";
  const companyId =
    typeof body.companyId === "string" && body.companyId.trim()
      ? body.companyId.trim()
      : DEFAULT_COMPANY;
  const speaker: Speaker =
    body.speaker === "rep" || body.speaker === "prospect" ? body.speaker : "unknown";

  try {
    // 1) Summon: the line called Vesper by name → speak the latest ready answer.
    if (detectWakeWord(text)) {
      const analysis: TranscriptAnalysis = {
        isWake: true,
        summon: lastSpeakable.get(callId) ?? null,
      };
      return NextResponse.json(analysis);
    }

    const detected = await detectQuestion({ text });

    // 2) A question → retrieve + grounded answer (whisper / private panel).
    if (detected.hasQuestion && detected.question) {
      const createdAt = new Date().toISOString();
      const detectedQuestion: DetectedQuestion = {
        id: crypto.randomUUID(),
        callId,
        question: detected.question,
        speaker,
        transcriptWindow: text,
        status: "new",
        category: detected.category,
        createdAt,
      };

      const retrieved = await retrieve({ companyId, query: detected.question });
      let answerCard: AnswerCard;
      if (retrieved.length === 0) {
        answerCard = {
          id: crypto.randomUUID(),
          callId,
          questionId: detectedQuestion.id,
          answer: REFUSAL,
          sourceCardIds: [],
          confidence: "low",
          canSpeak: false,
          createdAt,
        };
      } else {
        const result = await generateAnswer({
          question: detected.question,
          cards: retrieved.map((r) => r.card),
        });
        answerCard = {
          id: crypto.randomUUID(),
          callId,
          questionId: detectedQuestion.id,
          answer: result.answer,
          sourceCardIds: result.sourceCardIds,
          confidence: result.confidence,
          canSpeak: result.canSpeak && result.confidence !== "low",
          createdAt,
        };
      }

      // Remember the latest speakable answer for a later wake-word summon.
      if (answerCard.canSpeak) lastSpeakable.set(callId, answerCard);

      const analysis: TranscriptAnalysis = { detectedQuestion, answerCard };
      return NextResponse.json(analysis);
    }

    // 3) A statement → check it against the KB for a clear contradiction.
    const cards = await getStore().list(companyId);
    const contra = await detectContradiction({ statement: text, cards });
    if (contra.hasContradiction) {
      const correctionCard: CorrectionCard = {
        id: crypto.randomUUID(),
        callId,
        repStatement: contra.repStatement ?? text,
        issue: contra.issue ?? "",
        suggestedCorrection: contra.suggestedCorrection ?? "",
        sourceCardIds: contra.sourceCardIds ?? [],
        severity: contra.severity ?? "medium",
        createdAt: new Date().toISOString(),
      };
      return NextResponse.json({ correctionCard } satisfies TranscriptAnalysis);
    }

    // Nothing actionable on this line.
    return NextResponse.json({} satisfies TranscriptAnalysis);
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
      { error: "Could not analyze the transcript line." },
      { status: 502 },
    );
  }
}
