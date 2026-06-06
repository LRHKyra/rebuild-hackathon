"use client";

// Traces to: spec/features/voice-loop.md — the idea-agnostic voice core risk:
//   STT in:  mic -> /api/scribe/token -> Scribe realtime -> transcript on screen
//   TTS out: a string -> /api/tts -> audio played in the browser
//   + half-duplex gating (mute STT while TTS plays) and a no-voice fallback.
//
// This deliberately does NOT use Conversational AI. Verified against installed
// @elevenlabs/react useScribe: { status, isConnected, partialTranscript,
// committedTranscripts, error, connect({token}), disconnect, mute, unmute }.

import { useCallback, useRef, useState } from "react";
import { useScribe } from "@elevenlabs/react";
import { fetchScribeToken, synthesizeSpeech } from "@/lib/elevenlabs";
import { Transcript } from "@/components/Transcript";
import type { TranscriptLine, VoiceStatus } from "@/types";

const SAMPLE_TTS_TEXT =
  "Hello, this is Vesper. The voice loop is working end to end.";

export function VoiceAgent() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsText, setTtsText] = useState(SAMPLE_TTS_TEXT);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const scribe = useScribe({
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : "Voice transcription error.",
      ),
  });

  // Prefer a connect/TTS error we captured; otherwise the SDK's own error state.
  const effectiveError = errorMessage ?? scribe.error;
  const status: VoiceStatus = effectiveError ? "error" : scribe.status;

  const lines: TranscriptLine[] = scribe.committedTranscripts.map((segment) => ({
    id: segment.id,
    text: segment.text,
    isFinal: segment.isFinal,
  }));

  const start = useCallback(async () => {
    setErrorMessage(null);
    try {
      const token = await fetchScribeToken();
      // connect() requests mic permission and opens the Scribe WebSocket.
      await scribe.connect({ token });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not start transcription.",
      );
    }
  }, [scribe]);

  const stop = useCallback(() => {
    try {
      scribe.disconnect();
    } catch {
      // Disconnecting should never block the UI.
    }
  }, [scribe]);

  // Demo TTS. In the product this text is an ad-hoc grounded answer; here it's a
  // typed string. Half-duplex: mute STT while Vesper speaks so the mic doesn't
  // re-capture the synthesized audio.
  const speak = useCallback(async () => {
    const text = ttsText.trim();
    if (!text || isSpeaking) return;

    setErrorMessage(null);
    setIsSpeaking(true);
    const wasConnected = scribe.isConnected;
    if (wasConnected) scribe.mute();

    const restore = () => {
      if (wasConnected) scribe.unmute();
      setIsSpeaking(false);
    };

    try {
      const blob = await synthesizeSpeech(text);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        restore();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setErrorMessage("Could not play synthesized audio.");
        restore();
      };
      await audio.play();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not synthesize speech.",
      );
      restore();
    }
  }, [ttsText, isSpeaking, scribe]);

  const isConnecting = status === "connecting";
  const canStart = status === "disconnected" || status === "error";

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={!canStart}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {isConnecting ? "Connecting…" : "Start transcription"}
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={!scribe.isConnected}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-gray-600"
        >
          Stop
        </button>
        <StatusBadge status={status} speaking={isSpeaking} />
      </div>

      {/* TTS test row — proves the "speak a given string" half of the loop. */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={ttsText}
          onChange={(event) => setTtsText(event.target.value)}
          placeholder="Text for Vesper to speak…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        />
        <button
          type="button"
          onClick={speak}
          disabled={isSpeaking || !ttsText.trim()}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {isSpeaking ? "Speaking…" : "Speak"}
        </button>
      </div>

      {/* No-voice fallback: shown whenever STT/TTS errors. */}
      {status === "error" && (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          <p className="font-medium">Voice unavailable — fallback mode.</p>
          {effectiveError && <p className="mt-1">{effectiveError}</p>}
          <p className="mt-1 text-xs opacity-80">
            Continue with the typed-transcript path; the rest of the flow works.
          </p>
        </div>
      )}

      <Transcript lines={lines} partial={scribe.partialTranscript} />
    </section>
  );
}

function StatusBadge({
  status,
  speaking,
}: {
  status: VoiceStatus;
  speaking: boolean;
}) {
  const label = speaking ? "Vesper speaking" : status;

  const color = speaking
    ? "bg-emerald-500"
    : status === "connected" || status === "transcribing"
      ? "bg-green-500"
      : status === "connecting"
        ? "bg-yellow-500"
        : status === "error"
          ? "bg-red-500"
          : "bg-gray-400";

  return (
    <span className="ml-auto flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  );
}
