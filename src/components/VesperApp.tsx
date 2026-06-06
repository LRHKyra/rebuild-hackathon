"use client";

// Traces to: spec/product.md §6 (product surfaces) + §1 (thesis). Lane C owns this
// file. Top-level shell: navigate between the Knowledge setup page (§6A) and the
// live Call workspace (§6B). Shared state (agent name, company, knowledge cards)
// lives here so both surfaces stay in sync. Renders cleanly on mock data; the
// knowledge list is loaded live from /api/knowledge when available.

import { useCallback, useEffect, useState } from "react";
import type { KnowledgeCard } from "@/types";
import { DEFAULT_AGENT_NAME, MOCK_KNOWLEDGE_CARDS } from "@/lib/fixtures";
import { listKnowledge } from "@/lib/vesper-client";
import { KnowledgePage } from "@/components/KnowledgePage";
import { CallWorkspace, DemoRunnerBar } from "@/components/CallWorkspace";
import { useCallSession } from "@/components/useCallSession";
import { VoiceAgent } from "@/components/VoiceAgent";

type Tab = "call" | "knowledge";
type PublicCard = Omit<KnowledgeCard, "embedding">;

export function VesperApp() {
  const [tab, setTab] = useState<Tab>("knowledge");
  // Agent + company are fixed for the demo (no longer edited on the Knowledge tab).
  // agentName drives the wake-word match, panel label, and summon phrase.
  const [agentName] = useState(DEFAULT_AGENT_NAME);
  const [companyName] = useState("AcmeFlow");
  const [cards, setCards] = useState<PublicCard[]>([]);
  const [showVoiceCore, setShowVoiceCore] = useState(false);

  const refreshCards = useCallback(async () => {
    try {
      setCards(await listKnowledge());
    } catch {
      // Knowledge service not configured — the rehearsed demo uses mock cards.
      setCards([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const live = await listKnowledge();
        if (!cancelled) setCards(live);
      } catch {
        // Knowledge service not configured — the rehearsed demo uses mock cards.
        if (!cancelled) setCards([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // For the Call workspace's source lookup, prefer live cards but fall back to the
  // AcmeFlow mock cards so sources still resolve in a no-backend demo.
  const knowledgeForWorkspace = cards.length > 0 ? cards : MOCK_KNOWLEDGE_CARDS;

  // The call session (transcript, panel analysis, demo-runner progress) lives here
  // so it survives tab switches — Scene 1 of the demo shows the Knowledge page,
  // which unmounts the workspace. The runner switches tabs itself per scene.
  const goToKnowledge = useCallback(() => setTab("knowledge"), []);
  const goToCall = useCallback(() => setTab("call"), []);
  const session = useCallSession({ agentName, goToKnowledge, goToCall });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{agentName}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              A summonable AI expert for live calls — listens silently, helps
              privately, speaks only when called by name.
            </p>
          </div>
        </div>
        <nav className="flex gap-1 rounded-lg border border-gray-200 p-1 text-sm dark:border-gray-700">
          <TabButton active={tab === "knowledge"} onClick={() => setTab("knowledge")}>
            Knowledge
          </TabButton>
          <TabButton active={tab === "call"} onClick={() => setTab("call")}>
            Live call
          </TabButton>
        </nav>
      </header>

      {/* Persistent across both tabs so the rehearsed §16 flow (Scene 1 = Knowledge,
          Scene 2+ = live call) can be driven from anywhere without losing state. */}
      <DemoRunnerBar session={session} companyName={companyName} />

      {tab === "knowledge" ? (
        <KnowledgePage
          agentName={agentName}
          cards={cards}
          onCardsChanged={refreshCards}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <CallWorkspace
            agentName={agentName}
            session={session}
            knowledgeCards={knowledgeForWorkspace}
          />

          {/* The real, idea-agnostic voice core (Scribe STT + TTS). Lane B fully
              wires live STT into the workspace; exposed here so the mic loop is
              reachable from the product UI. */}
          <section className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setShowVoiceCore((v) => !v)}
              className="text-xs font-semibold tracking-wide text-gray-500 uppercase"
            >
              {showVoiceCore ? "▾" : "▸"} Live voice core (mic + TTS)
            </button>
            {showVoiceCore && (
              <div className="mt-3">
                <VoiceAgent />
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 font-medium ${
        active
          ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900"
          : "text-gray-600 dark:text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}
