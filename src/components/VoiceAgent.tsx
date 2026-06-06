"use client";

// Traces to: spec/features/voice-loop.md — Start/Stop, visible status, transcript
// state, signed-URL connection via the ElevenLabs SDK, and a no-voice fallback.
//
// Verified against installed @elevenlabs/react@1.6.4:
//   - useConversation() MUST be used inside a <ConversationProvider>.
//   - conversation.status: "disconnected" | "connecting" | "connected" | "error"
//   - conversation.startSession({ signedUrl, connectionType: "websocket" })
//   - onMessage payload (MessagePayload): { message: string, role: "user" | "agent", source }

import { useCallback, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { fetchSignedUrl } from "@/lib/elevenlabs";
import type { TranscriptMessage, VoiceStatus } from "@/types";
import { Transcript } from "@/components/Transcript";

// Public component: provides the ElevenLabs conversation context, then renders
// the actual UI inside it (useConversation requires the provider as an ancestor).
export function VoiceAgent() {
  return (
    <ConversationProvider>
      <VoiceAgentInner />
    </ConversationProvider>
  );
}

// Stable-ish id for a transcript line. crypto.randomUUID exists in all modern
// browsers, so this is safe in a "use client" component.
function newMessageId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

function VoiceAgentInner() {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => setErrorMessage(null),
    onError: (message: string) => setErrorMessage(message),
    // Param type is inferred from the SDK's onMessage callback (MessagePayload).
    onMessage: ({ message, role }) => {
      setMessages((prev) => [...prev, { id: newMessageId(), role, text: message }]);
    },
  });

  // Pre-session failures (mic denied, signed-URL fetch failed) won't move the
  // SDK status, so our own errorMessage takes precedence for the fallback UI.
  const status: VoiceStatus = errorMessage ? "error" : conversation.status;

  const start = useCallback(async () => {
    setErrorMessage(null);
    try {
      // Surface mic-permission failures clearly before we connect.
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const signedUrl = await fetchSignedUrl();
      await conversation.startSession({ signedUrl, connectionType: "websocket" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start the voice session.";
      setErrorMessage(message);
    }
  }, [conversation]);

  const stop = useCallback(() => {
    try {
      conversation.endSession();
    } catch {
      // Ending a session should never block the UI; ignore.
    }
  }, [conversation]);

  const isConnecting = status === "connecting";
  const isConnected = status === "connected";
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
          {isConnecting ? "Connecting…" : "Start"}
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={!isConnected}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-gray-600"
        >
          Stop
        </button>
        <StatusBadge status={status} speaking={conversation.isSpeaking} />
      </div>

      {/* No-voice fallback: shown whenever a connection/permission error occurs. */}
      {status === "error" && (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          <p className="font-medium">Voice unavailable — fallback mode.</p>
          {errorMessage && <p className="mt-1">{errorMessage}</p>}
          <p className="mt-1 text-xs opacity-80">
            Continue the demo without voice; the rest of the flow still works.
          </p>
        </div>
      )}

      <Transcript messages={messages} />
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
  const label =
    status === "connected"
      ? speaking
        ? "agent speaking"
        : "listening"
      : status;

  const color =
    status === "connected"
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
