"use client";

// Traces to: spec/product.md §6B (live call workspace) + §6C (summon) + §16 (demo).
// Lane C owns this file. The workspace: transcript (left), private Vesper panel
// (right), controls (bottom). The call/demo state lives in useCallSession so it
// survives tab switches (Scene 1 shows the Knowledge page). Two input paths feed
// the same panel:
//   - Demo runner (DemoRunnerBar, rendered at the app level so it stays drivable
//     from either tab): steps through the rehearsed §16 script with baked-in §13
//     analysis — works with zero backend (mock mode), real voice on summon.
//   - Typed fallback: free lines; in "live" mode they hit the real routes
//     (Lane A's /api/answer today; Lane B's /api/call/transcript when it lands).
// Vesper NEVER speaks unless summoned by name (§11).

import { useMemo } from "react";
import type { KnowledgeCard } from "@/types";
import { MOCK_KNOWLEDGE_CARDS, cardsById } from "@/lib/fixtures";
import type { CallLine, CallSession, CallSpeaker, Mode } from "@/components/useCallSession";
import { PrivatePanel } from "@/components/PrivatePanel";

type PublicCard = Omit<KnowledgeCard, "embedding">;

type CallWorkspaceProps = {
  agentName: string;
  session: CallSession;
  // Live knowledge cards (from /api/knowledge) so sources resolve to titles.
  knowledgeCards: PublicCard[];
};

export function CallWorkspace({
  agentName,
  session,
  knowledgeCards,
}: CallWorkspaceProps) {
  const {
    lines,
    question,
    answer,
    correction,
    spoken,
    summoning,
    error,
    mode,
    setMode,
    typed,
    setTyped,
    typedSpeaker,
    setTypedSpeaker,
    submitTyped,
    manualSummon,
  } = session;

  // Source lookup spans mock (kc-*) and live ids so both resolve to titles.
  const sourcesById = useMemo(
    () => cardsById([...MOCK_KNOWLEDGE_CARDS, ...knowledgeCards]),
    [knowledgeCards],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Transcript + panel */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="flex min-h-[18rem] flex-col rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-700 uppercase dark:text-gray-300">
            Call transcript
          </h2>
          <CallTranscript lines={lines} agentName={agentName} />
        </section>

        <section className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950/40">
          <PrivatePanel
            agentName={agentName}
            question={question}
            answer={answer}
            correction={correction}
            sourcesById={sourcesById}
            spoken={spoken}
            summoning={summoning}
            onSummon={manualSummon}
          />
        </section>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          {error}
        </p>
      )}

      {/* Typed fallback controls */}
      <section className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Typed input (demo fallback)
          </span>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typedSpeaker}
            onChange={(e) => setTypedSpeaker(e.target.value as "prospect" | "rep")}
            className="rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="prospect">Prospect</option>
            <option value="rep">Rep</option>
          </select>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitTyped();
            }}
            placeholder={`Type a line… (try "${agentName}, can you take that one?")`}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
          <button
            type="button"
            onClick={() => void submitTyped()}
            disabled={!typed.trim()}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-gray-200 dark:text-gray-900"
          >
            Add line
          </button>
        </div>
        <p className="text-xs text-gray-400">
          {mode === "mock"
            ? "Mock mode: the demo runner drives the rehearsed flow with no backend. Summon still uses real ElevenLabs voice if configured."
            : "Live mode: prospect questions hit the real retrieval + answer pipeline. Saying the agent's name summons a spoken answer."}
        </p>
      </section>
    </div>
  );
}

// The rehearsed §16 demo controls. Rendered at the app level (not inside the
// workspace) so the presenter can advance scenes from either tab — Scene 1 shows
// the Knowledge page, later scenes the live call.
export function DemoRunnerBar({
  session,
  companyName,
}: {
  session: CallSession;
  companyName: string;
}) {
  const { sceneIndex, currentScene, atEnd, advanceScene, resetDemo } = session;
  return (
    <section className="rounded-xl border border-hairline bg-panel p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-ink-muted">
          Demo runner · {companyName}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void advanceScene()}
            disabled={atEnd}
            className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-panel disabled:opacity-40"
          >
            {sceneIndex < 0 ? "Start demo" : atEnd ? "End" : "Next scene →"}
          </button>
          <button
            type="button"
            onClick={resetDemo}
            className="rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
          >
            Reset
          </button>
        </div>
      </div>
      {currentScene && (
        <div className="mt-2">
          <p className="text-xs font-medium text-ink">
            {currentScene.title}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {currentScene.narration}
          </p>
        </div>
      )}
    </section>
  );
}

function CallTranscript({
  lines,
  agentName,
}: {
  lines: CallLine[];
  agentName: string;
}) {
  if (lines.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">
        The conversation appears here. Run the demo or type a line to begin.
      </p>
    );
  }
  const label: Record<CallSpeaker, string> = {
    prospect: "Prospect",
    rep: "Rep",
    unknown: "Speaker",
    vesper: agentName,
  };
  const color: Record<CallSpeaker, string> = {
    prospect: "text-blue-600 dark:text-blue-400",
    rep: "text-gray-700 dark:text-gray-300",
    unknown: "text-gray-500",
    vesper: "text-indigo-600 dark:text-indigo-400",
  };
  return (
    <ul className="flex flex-1 flex-col gap-2 overflow-y-auto text-sm" aria-live="polite">
      {lines.map((line) => (
        <li key={line.id}>
          <span className={`font-semibold ${color[line.speaker]}`}>
            {label[line.speaker]}:
          </span>{" "}
          <span className="text-gray-900 dark:text-gray-100">{line.text}</span>
        </li>
      ))}
    </ul>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-gray-300 p-0.5 text-xs dark:border-gray-600">
      {(["mock", "live"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`rounded px-2 py-1 font-medium capitalize ${
            mode === m
              ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900"
              : "text-gray-500"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
