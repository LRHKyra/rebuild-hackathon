"use client";

// Traces to: spec/product.md §6B (live call workspace) + §6C (summon) + §16 (demo).
// Lane C owns this file. The call session — transcript, private-panel analysis,
// summon, and demo-runner progress — lives in this hook (not inside CallWorkspace)
// so it SURVIVES tab switches. Scene 1 of the §16 demo shows the Knowledge page,
// which unmounts the workspace; keeping the state here means the rehearsed flow
// (Scene 1 → Scene 2 → …) is never lost and the demo-runner bar stays drivable
// from either tab. Vesper NEVER speaks unless summoned by name (§11).

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  AnswerCard,
  CorrectionCard,
  DetectedQuestion,
  Speaker,
  TranscriptAnalysis,
} from "@/types";
import { DEMO_CALL_ID } from "@/lib/fixtures";
import { DEMO_SCRIPT } from "@/lib/demo-script";
import {
  RouteNotImplementedError,
  analyzeTranscript,
  askAnswer,
  summonSpeak,
} from "@/lib/vesper-client";

export type Mode = "mock" | "live";
export type CallSpeaker = Speaker | "vesper";
export type CallLine = { id: string; speaker: CallSpeaker; text: string };

function isWakePhrase(text: string, agentName: string): boolean {
  // Minimal client-side wake match for the typed path. Lane B owns the real
  // matcher (src/lib/wakeword.ts) used server-side; this just makes the typed
  // demo feel live. Matches "<agent>, ..." or "bring in <agent>".
  const t = text.toLowerCase();
  const name = agentName.toLowerCase();
  if (!t.includes(name)) return false;
  return (
    new RegExp(`${name}\\s*,`).test(t) ||
    /\b(take that|what'?s our answer|can you (take|explain|answer)|bring in)\b/.test(
      t,
    )
  );
}

type UseCallSessionParams = {
  agentName: string;
  // Tab navigation, so the demo runner can show the right surface per scene.
  goToKnowledge: () => void;
  goToCall: () => void;
};

export function useCallSession({
  agentName,
  goToKnowledge,
  goToCall,
}: UseCallSessionParams) {
  const [mode, setMode] = useState<Mode>("mock");
  const [lines, setLines] = useState<CallLine[]>([]);
  const [question, setQuestion] = useState<DetectedQuestion | null>(null);
  const [answer, setAnswer] = useState<AnswerCard | null>(null);
  const [correction, setCorrection] = useState<CorrectionCard | null>(null);
  const [spoken, setSpoken] = useState(false);
  const [summoning, setSummoning] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(-1);
  const [typed, setTyped] = useState("");
  const [typedSpeaker, setTypedSpeaker] = useState<Speaker>("prospect");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const addLine = useCallback((speaker: CallSpeaker, text: string) => {
    setLines((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, speaker, text },
    ]);
  }, []);

  const applyAnalysis = useCallback((a: TranscriptAnalysis) => {
    if (a.detectedQuestion) {
      setQuestion(a.detectedQuestion);
      setCorrection(null); // new topic clears the previous private warning
    }
    if (a.answerCard) {
      setAnswer(a.answerCard);
      setSpoken(false);
    }
    if (a.correctionCard) setCorrection(a.correctionCard);
  }, []);

  // Summon: Vesper speaks aloud. `text` overrides the current answer (used by the
  // script). Audio plays via /api/summon (Lane B) or /api/tts fallback. Even if
  // audio fails, we add Vesper's line so the demo keeps moving.
  const doSummon = useCallback(
    async (wakePhrase: string, text?: string) => {
      const spokenText = text ?? answer?.answer;
      if (!spokenText) return;
      setSummoning(true);
      setError(null);
      try {
        const { audio, spokenText: said } = await summonSpeak({
          callId: DEMO_CALL_ID,
          wakePhrase,
          fallbackText: spokenText,
        });
        addLine("vesper", said);
        setSpoken(true);
        const url = URL.createObjectURL(audio);
        const el = new Audio(url);
        audioRef.current = el;
        el.onended = () => URL.revokeObjectURL(url);
        await el.play().catch(() => URL.revokeObjectURL(url));
      } catch (e) {
        // Voice unavailable (e.g. no ElevenLabs key): still show the spoken text.
        addLine("vesper", spokenText);
        setSpoken(true);
        setError(
          e instanceof Error
            ? `Voice unavailable — showing ${agentName}'s answer as text. (${e.message})`
            : "Voice unavailable.",
        );
      } finally {
        setSummoning(false);
      }
    },
    [answer, addLine, agentName],
  );

  // ── Demo runner ──────────────────────────────────────────────────────────
  const advanceScene = useCallback(async () => {
    const next = sceneIndex + 1;
    if (next >= DEMO_SCRIPT.length) return;
    const scene = DEMO_SCRIPT[next];
    setSceneIndex(next);
    // Show the right surface for the scene: Knowledge for setup, the live call
    // workspace for everything else — so Scene 1 → Scene 2 flows on its own.
    if (scene.showKnowledge) goToKnowledge();
    else goToCall();
    if (scene.line) addLine(scene.line.speaker, scene.line.text);
    if (scene.analysis) applyAnalysis(scene.analysis);
    if (scene.summon) await doSummon(scene.line?.text ?? agentName, scene.spokenText);
  }, [
    sceneIndex,
    addLine,
    applyAnalysis,
    doSummon,
    goToKnowledge,
    goToCall,
    agentName,
  ]);

  const resetDemo = useCallback(() => {
    setSceneIndex(-1);
    setLines([]);
    setQuestion(null);
    setAnswer(null);
    setCorrection(null);
    setSpoken(false);
    setError(null);
  }, []);

  // ── Typed fallback ─────────────────────────────────────────────────────────
  const submitTyped = useCallback(async () => {
    const text = typed.trim();
    if (!text) return;
    setTyped("");
    setError(null);
    addLine(typedSpeaker, text);

    if (isWakePhrase(text, agentName)) {
      await doSummon(text);
      return;
    }
    if (mode === "mock") return; // mock mode: scripted analysis only

    try {
      const analysis = await analyzeTranscript({
        callId: DEMO_CALL_ID,
        speaker: typedSpeaker,
        text,
      });
      applyAnalysis(analysis);
    } catch (e) {
      if (e instanceof RouteNotImplementedError) {
        // Lane B's pipeline isn't live yet — fall back to Lane A's /api/answer for
        // prospect questions (real retrieval). Rep statements need Lane B's
        // contradiction step, so we just log them for now.
        if (typedSpeaker === "prospect") {
          try {
            const dq: DetectedQuestion = {
              id: `dq-${Date.now()}`,
              callId: DEMO_CALL_ID,
              question: text,
              speaker: typedSpeaker,
              transcriptWindow: text,
              status: "new",
              createdAt: new Date().toISOString(),
            };
            const ac = await askAnswer({
              callId: DEMO_CALL_ID,
              question: text,
              questionId: dq.id,
            });
            applyAnalysis({ detectedQuestion: dq, answerCard: ac });
          } catch (inner) {
            setError(inner instanceof Error ? inner.message : "Answer failed.");
          }
        }
      } else {
        setError(e instanceof Error ? e.message : "Analysis failed.");
      }
    }
  }, [typed, typedSpeaker, mode, agentName, addLine, doSummon, applyAnalysis]);

  const manualSummon = useCallback(
    () => doSummon(`${agentName}, can you take that one?`),
    [doSummon, agentName],
  );

  const currentScene = sceneIndex >= 0 ? DEMO_SCRIPT[sceneIndex] : null;
  const atEnd = sceneIndex >= DEMO_SCRIPT.length - 1;

  return useMemo(
    () => ({
      // transcript + panel state
      lines,
      question,
      answer,
      correction,
      spoken,
      summoning,
      error,
      // demo runner
      sceneIndex,
      currentScene,
      atEnd,
      advanceScene,
      resetDemo,
      // typed fallback
      mode,
      setMode,
      typed,
      setTyped,
      typedSpeaker,
      setTypedSpeaker,
      submitTyped,
      // panel summon affordance
      manualSummon,
    }),
    [
      lines,
      question,
      answer,
      correction,
      spoken,
      summoning,
      error,
      sceneIndex,
      currentScene,
      atEnd,
      advanceScene,
      resetDemo,
      mode,
      typed,
      typedSpeaker,
      submitTyped,
      manualSummon,
    ],
  );
}

export type CallSession = ReturnType<typeof useCallSession>;
