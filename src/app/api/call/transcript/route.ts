// Traces to: spec/product.md §13 (POST /api/call/transcript) + §6/§10/§11 + plan.
//
// The call-analysis loop = "whisper mode". For each transcript line:
//   - wake word ("Vesper, …")? → return the latest speakable answer to summon.
//   - else a question? → detect → retrieve → grounded answer (or refusal).
//   - else a statement? → GATE (rep + relevant), then flag only egregious,
//     grounded contradictions of a checkable claim.
// Each LLM call gets a small rolling transcript window for context. Returns
// TranscriptAnalysis (+ a debug block when ?debug=1). Reference impl Lane B extends.

import { NextResponse } from "next/server";
import { detectWakeWord } from "@/lib/wakeword";
import { retrieve } from "@/lib/retrieval";
import { detectQuestion, generateAnswer, detectContradiction } from "@/lib/llm";
import { MissingEnvError } from "@/lib/env";
import type {
  AnswerCard,
  CorrectionCard,
  DetectedQuestion,
  RetrievedCard,
  Speaker,
  TranscriptAnalysis,
} from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_COMPANY = "demo-company";
const REFUSAL =
  "I do not have that confirmed in the product knowledge base. I would not want to guess.";

// How many recent lines of context to give the LLMs (the rolling window).
const MAX_WINDOW_LINES = 4;
// Minimum top-card similarity before we bother running a contradiction check.
// Below this, the statement isn't really about our product → skip. Tunable.
const CONTRADICTION_SCORE_THRESHOLD = Number(
  process.env.CONTRADICTION_SCORE_THRESHOLD ?? "0.3",
);

// Per-call memory of the latest speakable answer, so a wake-word line (which may
// not itself contain the question) can summon the answer from a prior turn.
const lastSpeakable = new Map<string, AnswerCard>();
// Per-call rolling transcript history (recent lines), for LLM context.
const history = new Map<string, string[]>();

function isDebug(request: Request): boolean {
  return (
    new URL(request.url).searchParams.get("debug") === "1" ||
    process.env.LLM_DEBUG === "1"
  );
}

function toRetrievedDebug(cards: RetrievedCard[]) {
  return cards.map((r) => ({ id: r.card.id, title: r.card.title, score: r.score }));
}

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

  // Rolling context: the window is the PRIOR lines; this line is what we inspect.
  const prior = history.get(callId) ?? [];
  const windowText = prior.join("\n");
  history.set(callId, [...prior, text].slice(-MAX_WINDOW_LINES));
  const debug = isDebug(request);

  try {
    // 1) Summon: the line called Vesper by name → speak the latest ready answer.
    if (detectWakeWord(text)) {
      const analysis: TranscriptAnalysis = {
        isWake: true,
        summon: lastSpeakable.get(callId) ?? null,
        ...(debug ? { debug: { gating: { isWake: true } } } : {}),
      };
      return NextResponse.json(analysis);
    }

    const detected = await detectQuestion({
      text,
      transcriptWindow: windowText || undefined,
    });

    // 2) A question → retrieve + grounded answer (whisper / private panel).
    if (detected.hasQuestion && detected.question) {
      const createdAt = new Date().toISOString();
      const detectedQuestion: DetectedQuestion = {
        id: crypto.randomUUID(),
        callId,
        question: detected.question,
        speaker,
        transcriptWindow: windowText || text,
        status: "new",
        category: detected.category,
        createdAt,
      };

      const retrieved = await retrieve({ companyId, query: detected.question });
      let answerCard: AnswerCard;
      let answerDebug: unknown;
      if (retrieved.length === 0) {
        answerCard = {
          id: crypto.randomUUID(),
          callId,
          questionId: detectedQuestion.id,
          answer: REFUSAL,
          spokenAnswer: REFUSAL,
          sourceCardIds: [],
          confidence: "low",
          canSpeak: false,
          createdAt,
        };
      } else {
        const result = await generateAnswer({
          question: detected.question,
          transcriptContext: windowText || undefined,
          cards: retrieved.map((r) => r.card),
        });
        answerCard = {
          id: crypto.randomUUID(),
          callId,
          questionId: detectedQuestion.id,
          answer: result.answer,
          spokenAnswer: result.spokenAnswer,
          sourceCardIds: result.sourceCardIds,
          confidence: result.confidence,
          canSpeak: result.canSpeak && result.confidence !== "low",
          createdAt,
        };
        answerDebug = {
          answer: result.answer,
          spokenAnswer: result.spokenAnswer,
          confidence: result.confidence,
          sourceCardIds: result.sourceCardIds,
          rawCanSpeak: result.canSpeak,
          finalCanSpeak: answerCard.canSpeak,
        };
      }

      // Remember the latest speakable answer for a later wake-word summon.
      if (answerCard.canSpeak) lastSpeakable.set(callId, answerCard);

      const analysis: TranscriptAnalysis = {
        detectedQuestion,
        answerCard,
        ...(debug
          ? {
              debug: {
                detect: detected,
                retrieved: toRetrievedDebug(retrieved),
                answer: answerDebug,
              },
            }
          : {}),
      };
      return NextResponse.json(analysis);
    }

    // 3) A statement → only worth a contradiction check if it's the rep (not the
    // prospect) AND retrieval actually found a relevant card. These cheap gates
    // kill false alarms on chit-chat and keep it real-time.
    const relevant = await retrieve({ companyId, query: text, topK: 8 });
    const topScore = relevant[0]?.score ?? 0;
    const speakerOk = speaker !== "prospect"; // rep or unlabeled
    const relevanceOk = topScore >= CONTRADICTION_SCORE_THRESHOLD;
    const shouldCheck = speakerOk && relevanceOk && relevant.length > 0;

    const gating = {
      speaker,
      topScore,
      threshold: CONTRADICTION_SCORE_THRESHOLD,
      speakerOk,
      relevanceOk,
      checked: shouldCheck,
    };

    let contra:
      | Awaited<ReturnType<typeof detectContradiction>>
      | undefined;
    if (shouldCheck) {
      contra = await detectContradiction({
        statement: text,
        cards: relevant.map((r) => r.card),
      });
    }

    // Flag only an egregious, grounded contradiction of a real checkable claim.
    if (contra?.isCheckableClaim && contra.hasContradiction) {
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
      const analysis: TranscriptAnalysis = {
        correctionCard,
        ...(debug
          ? { debug: { retrieved: toRetrievedDebug(relevant), contradiction: contra, gating } }
          : {}),
      };
      return NextResponse.json(analysis);
    }

    // Nothing actionable on this line.
    const analysis: TranscriptAnalysis = {
      ...(debug
        ? {
            debug: {
              detect: detected,
              retrieved: toRetrievedDebug(relevant),
              contradiction: contra ?? null,
              gating,
            },
          }
        : {}),
    };
    return NextResponse.json(analysis);
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
