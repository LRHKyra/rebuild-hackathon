// Traces to: spec/product.md §13 (POST /api/call/transcript) + §6/§10/§11.
//
// The call-analysis loop = "whisper mode". For each transcript line:
//   - wake word ("Vesper, can you take that one?")? → return isWake + the latest
//     speakable answer so the client can summon Vesper (audio via /api/summon).
//   - else a question? → detect → retrieve → grounded answer (or refusal).
//   - else a statement? → GATE (rep/unlabeled + relevant), then flag only an
//     egregious, grounded contradiction of a checkable claim.
//
// Shared call state (transcript history + latest question/answer/correction) lives
// in callState.ts so /api/summon can speak the prepared answer without recomputing.
// Each LLM call gets a rolling transcript window for context. Returns
// TranscriptAnalysis (+ a debug block when ?debug=1).

import { NextResponse } from "next/server";
import {
  addTranscriptEvent,
  getCallMemory,
  rememberAnswer,
  rememberCorrection,
  rememberQuestion,
  transcriptWindow,
} from "@/lib/callState";
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

const DEFAULT_CALL = "demo-call";
const DEFAULT_COMPANY = "demo-company";
const REFUSAL =
  "I do not have that confirmed in the product knowledge base. I would not want to guess.";

// Cards to retrieve for the contradiction check (§10C: scope to retrieved, not the
// full KB, so a 140-page PDF doesn't overflow the model's context at real scale).
const CONTRADICTION_TOP_K = 8;
// Minimum top-card similarity before we bother running a contradiction check.
// Below this, the statement isn't really about our product → skip. Tunable.
const CONTRADICTION_SCORE_THRESHOLD = Number(
  process.env.CONTRADICTION_SCORE_THRESHOLD ?? "0.3",
);

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
  const callId = stringOrDefault(body.callId, DEFAULT_CALL);
  const companyId = stringOrDefault(body.companyId, DEFAULT_COMPANY);
  const speaker = parseSpeaker(body.speaker);
  const debug = isDebug(request);

  // Record this line first; the rolling window then includes it as context.
  addTranscriptEvent({ callId, speaker, text });
  const window = transcriptWindow(callId);

  try {
    // 1) Summon: the line called Vesper by name → surface the latest speakable
    // answer. The actual audio is produced by /api/summon; here we just signal the
    // wake and hand back the prepared answer (or null if none is ready).
    if (detectWakeWord(text).matched) {
      const latest = getCallMemory(callId).latestAnswer;
      const summon = latest?.canSpeak ? latest : null;
      const analysis: TranscriptAnalysis = {
        isWake: true,
        summon,
        ...(debug ? { debug: { gating: { isWake: true } } } : {}),
      };
      return NextResponse.json(analysis);
    }

    const detected = await detectQuestion({ text, transcriptWindow: window });

    // 2) A question → retrieve + grounded answer (whisper / private panel).
    if (detected.hasQuestion && detected.question) {
      const createdAt = new Date().toISOString();
      const detectedQuestion: DetectedQuestion = {
        id: crypto.randomUUID(),
        callId,
        question: detected.question,
        speaker,
        transcriptWindow: window,
        status: "new",
        category: detected.category,
        createdAt,
      };
      rememberQuestion(detectedQuestion);

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
          transcriptContext: window || undefined,
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
          // Enforce: only high/medium may be spoken (§10B).
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
      rememberAnswer(answerCard);

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
    const relevant = await retrieve({
      companyId,
      query: text,
      topK: CONTRADICTION_TOP_K,
    });
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

    let contra: Awaited<ReturnType<typeof detectContradiction>> | undefined;
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
      rememberCorrection(correctionCard);
      const analysis: TranscriptAnalysis = {
        correctionCard,
        ...(debug
          ? {
              debug: {
                retrieved: toRetrievedDebug(relevant),
                contradiction: contra,
                gating,
              },
            }
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

function parseSpeaker(value: unknown): Speaker {
  return value === "rep" || value === "prospect" || value === "unknown"
    ? value
    : "unknown";
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
