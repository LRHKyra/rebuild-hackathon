"use client";

// Traces to: spec/product.md §6B (Live Call Workspace), §13
// (POST /api/call/transcript + POST /api/summon), and workstreams.md Lane B.
// This is the demo safety path: typed transcript in, Vesper analysis out.

import { useCallback, useMemo, useState } from "react";
import type { AnswerCard, CorrectionCard, DetectedQuestion, Speaker } from "@/types";

type TranscriptRow = {
  id: string;
  speaker: Speaker;
  text: string;
};

type AnalysisResponse = {
  detectedQuestion?: DetectedQuestion | null;
  answerCard?: AnswerCard | null;
  correctionCard?: CorrectionCard | null;
};

const CALL_ID = "demo-call";
const COMPANY_ID = "demo-company";

const DEMO_KNOWLEDGE = `AcmeFlow is an AI workflow automation platform for enterprise operations teams.

Security and identity:
- AcmeFlow supports SSO through SAML 2.0 today.
- SCIM user provisioning is currently in private beta, not generally available.
- AcmeFlow has completed SOC 2 Type II.
- HIPAA is not supported today.

Integrations:
- Salesforce and HubSpot integrations are live.
- Workday integration is on the roadmap but not live.

Implementation and deployment:
- Typical implementation takes 2 to 4 weeks.
- Data retention is configurable up to 7 years.
- On-prem deployment is not supported.
- EU data residency is available on the enterprise plan.`;

const DEMO_LINES: Array<{ speaker: Speaker; text: string }> = [
  {
    speaker: "prospect",
    text: "Do you support SSO and SCIM? Our IT team will ask.",
  },
  {
    speaker: "rep",
    text: "And just to confirm, SCIM is fully generally available.",
  },
];

export function TypedTranscriptFallback() {
  const [speaker, setSpeaker] = useState<Speaker>("prospect");
  const [text, setText] = useState(DEMO_LINES[0].text);
  const [transcript, setTranscript] = useState<TranscriptRow[]>([]);
  const [question, setQuestion] = useState<DetectedQuestion | null>(null);
  const [answer, setAnswer] = useState<AnswerCard | null>(null);
  const [correction, setCorrection] = useState<CorrectionCard | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canAnalyze = text.trim().length > 0 && !isAnalyzing;
  const canSummon = !!answer && !isSpeaking;

  const latestStatus = useMemo(() => {
    if (errorMessage) return errorMessage;
    if (statusMessage) return statusMessage;
    if (answer?.canSpeak) return "Ready to answer if summoned.";
    if (answer && !answer.canSpeak) return "Private answer ready; not safe to speak.";
    return "Use the typed fallback to run the demo path.";
  }, [answer, errorMessage, statusMessage]);

  const seedKnowledge = useCallback(async () => {
    setIsSeeding(true);
    setErrorMessage(null);
    setStatusMessage("Loading AcmeFlow knowledge...");

    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: COMPANY_ID,
          title: "AcmeFlow demo knowledge",
          source: "product.md §15 demo knowledge",
          text: DEMO_KNOWLEDGE,
          topicTags: ["demo", "acmeflow"],
        }),
      });

      if (!response.ok) throw new Error(await safeErrorMessage(response));
      const data = (await response.json()) as { cardsCreated?: number };
      setStatusMessage(
        `Demo knowledge loaded (${data.cardsCreated ?? 0} cards).`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load demo knowledge.",
      );
    } finally {
      setIsSeeding(false);
    }
  }, []);

  const submitTranscript = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setIsAnalyzing(true);
    setErrorMessage(null);
    setStatusMessage("Analyzing transcript...");

    setTranscript((current) => [
      ...current,
      { id: crypto.randomUUID(), speaker, text: trimmed },
    ]);

    try {
      const response = await fetch("/api/call/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: CALL_ID,
          companyId: COMPANY_ID,
          speaker,
          text: trimmed,
        }),
      });

      if (!response.ok) throw new Error(await safeErrorMessage(response));
      const data = (await response.json()) as AnalysisResponse;
      if (data.detectedQuestion) setQuestion(data.detectedQuestion);
      if (data.answerCard) setAnswer(data.answerCard);
      if (data.correctionCard) setCorrection(data.correctionCard);
      setStatusMessage("Transcript analyzed.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not analyze transcript.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [speaker, text]);

  const summonVesper = useCallback(async () => {
    setIsSpeaking(true);
    setErrorMessage(null);
    setStatusMessage("Summoning Vesper...");

    try {
      const response = await fetch("/api/summon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: CALL_ID,
          companyId: COMPANY_ID,
          wakePhrase: "Vesper, can you take that one?",
        }),
      });

      if (!response.ok) throw new Error(await safeErrorMessage(response));

      const spokenHeader = response.headers.get("X-Vesper-Spoken-Text");
      const spokenText = spokenHeader
        ? decodeURIComponent(spokenHeader)
        : "Vesper answered aloud.";
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
        setErrorMessage("Could not play Vesper's audio.");
      };
      await audio.play();
      setTranscript((current) => [
        ...current,
        { id: crypto.randomUUID(), speaker: "unknown", text: `Vesper: ${spokenText}` },
      ]);
      setStatusMessage("Vesper spoke the latest answer.");
    } catch (error) {
      setIsSpeaking(false);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not summon Vesper.",
      );
    }
  }, []);

  const loadDemoLine = (index: number) => {
    const line = DEMO_LINES[index];
    setSpeaker(line.speaker);
    setText(line.text);
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">Typed demo fallback</h2>
        <button
          type="button"
          onClick={seedKnowledge}
          disabled={isSeeding}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-40 dark:border-gray-600"
        >
          {isSeeding ? "Loading..." : "Load demo KB"}
        </button>
        <button
          type="button"
          onClick={() => loadDemoLine(0)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-600"
        >
          SSO question
        </button>
        <button
          type="button"
          onClick={() => loadDemoLine(1)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-600"
        >
          SCIM mistake
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="typed-speaker">
          Speaker
        </label>
        <select
          id="typed-speaker"
          value={speaker}
          onChange={(event) => setSpeaker(event.target.value as Speaker)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        >
          <option value="prospect">Prospect</option>
          <option value="rep">Rep</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="typed-transcript">
          Transcript line
        </label>
        <textarea
          id="typed-transcript"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submitTranscript}
          disabled={!canAnalyze}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {isAnalyzing ? "Analyzing..." : "Send transcript"}
        </button>
        <button
          type="button"
          onClick={summonVesper}
          disabled={!canSummon}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {isSpeaking ? "Speaking..." : "Summon Vesper"}
        </button>
      </div>

      <p
        role={errorMessage ? "alert" : "status"}
        className={`text-sm ${errorMessage ? "text-red-600 dark:text-red-300" : "text-gray-600 dark:text-gray-300"}`}
      >
        {latestStatus}
      </p>

      {transcript.length > 0 && (
        <div className="rounded-md bg-gray-50 p-3 text-sm dark:bg-gray-900">
          <h3 className="font-medium">Transcript</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {transcript.map((line) => (
              <li key={line.id}>
                <span className="font-medium capitalize">{line.speaker}: </span>
                {line.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(question || answer || correction) && (
        <div className="grid gap-3">
          {question && (
            <PanelCard title="Detected question">
              <p>{question.question}</p>
            </PanelCard>
          )}
          {answer && (
            <PanelCard title="Suggested answer">
              <p>{answer.answer}</p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Confidence: {answer.confidence} · Sources:{" "}
                {answer.sourceCardIds.length > 0
                  ? answer.sourceCardIds.join(", ")
                  : "none"}
              </p>
            </PanelCard>
          )}
          {correction && (
            <PanelCard title="Private correction">
              <p className="font-medium">{correction.issue}</p>
              <p className="mt-1">{correction.suggestedCorrection}</p>
            </PanelCard>
          )}
        </div>
      )}
    </section>
  );
}

function PanelCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-md border border-gray-200 p-3 text-sm dark:border-gray-700">
      <h3 className="mb-1 font-semibold">{title}</h3>
      {children}
    </article>
  );
}

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // Fall through to the status fallback.
  }
  return `Request failed with status ${response.status}.`;
}
