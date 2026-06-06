"use client";

// Traces to: vesper-workspace-ui-spec.md (§3–§11, §13) + product.md §6B (private
// corrections) + Lane A's CorrectionCard (§8). Lane C owns this file.
//
// The Live Call advisor screen: a calm, glanceable surface the rep reads in
// ~1-second glances while on an audio call. Two columns — left: a never-erasing
// Corrections feed (newest at the BOTTOM, amber-highlighted; older greyed) with an
// in-column Source drawer that expands below it; right: large Personal notes plus
// two INERT placeholders (Chat w/ Vesper, Next topics).
//
// Data adheres to Lane A reality: corrections are real `CorrectionCard`s
// (repStatement / issue / suggestedCorrection / sourceCardIds / severity /
// createdAt). There is no `highlightPhrase` field in the backend, so the drawer
// shows the resolved KnowledgeCard text without an inline highlight. The screen is
// mock-driven (spec §10, re-themed to AcmeFlow so source chips resolve to real
// cards); swapping to live /api/call/transcript corrections is a state-feed change.
// Light-mode per spec §11; the rest of the app keeps its own theme for now.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CorrectionCard, KnowledgeCard } from "@/types";
import { DEMO_CALL_ID, MOCK_KNOWLEDGE_CARDS, cardsById } from "@/lib/fixtures";

type PublicCard = Omit<KnowledgeCard, "embedding">;
type SourceCard = Pick<KnowledgeCard, "id" | "title" | "source" | "text">;
type Note = { id: string; createdAt: number; text: string };

// ── Mock demo driver (spec §10), re-themed to AcmeFlow ──────────────────────────
// Editable timings (seconds). Each event mutates the screen state on a timer so the
// demo shows every behavior hands-free, with no backend.
const correction = (
  id: string,
  repStatement: string,
  issue: string,
  suggestedCorrection: string,
  sourceCardIds: string[],
  severity: CorrectionCard["severity"],
): CorrectionCard => ({
  id,
  callId: DEMO_CALL_ID,
  repStatement,
  issue,
  suggestedCorrection,
  sourceCardIds,
  severity,
  createdAt: new Date().toISOString(),
});

type DemoEvent =
  | { t: number; kind: "correction"; correction: CorrectionCard }
  | { t: number; kind: "note"; text: string }
  | { t: number; kind: "openSource"; cardId: string }
  | { t: number; kind: "closeSource" };

const DEMO_SCRIPT: DemoEvent[] = [
  {
    t: 1,
    kind: "correction",
    correction: correction(
      "corr-scim",
      "And SCIM is fully generally available today.",
      "Docs say SCIM is in private beta, not generally available.",
      "SCIM is in private beta, not GA — automated provisioning isn't generally available yet.",
      ["kc-security"],
      "high",
    ),
  },
  { t: 4, kind: "note", text: "competitor: Okta" },
  {
    t: 7,
    kind: "correction",
    correction: correction(
      "corr-hipaa",
      "Yes, we're HIPAA compliant.",
      "AcmeFlow does not support HIPAA workloads today.",
      "AcmeFlow is not HIPAA compliant and does not support HIPAA workloads today.",
      ["kc-security"],
      "high",
    ),
  },
  { t: 10, kind: "openSource", cardId: "kc-security" },
  { t: 16, kind: "note", text: "follow up: EU data residency" },
  { t: 19, kind: "closeSource" },
  {
    t: 22,
    kind: "correction",
    correction: correction(
      "corr-onprem",
      "You can deploy AcmeFlow fully on-prem.",
      "AcmeFlow is cloud-only; on-prem deployment isn't supported.",
      "AcmeFlow is cloud-only — on-premises deployment isn't supported today.",
      ["kc-implementation"],
      "medium",
    ),
  },
  { t: 26, kind: "openSource", cardId: "kc-implementation" },
];

// ── Component ────────────────────────────────────────────────────────────────

type AdvisorWorkspaceProps = {
  // Live knowledge cards (from /api/knowledge); falls back to the AcmeFlow mock so
  // source chips resolve to readable cards with no backend.
  knowledgeCards: PublicCard[];
};

// Wrapper: "replay" bumps the key so the screen remounts with fresh state, which
// keeps the timed driver's reset out of an effect body (no setState-in-effect).
export function AdvisorWorkspace({ knowledgeCards }: AdvisorWorkspaceProps) {
  const [runId, setRunId] = useState(0);
  return (
    <AdvisorScreen
      key={runId}
      knowledgeCards={knowledgeCards}
      onReplay={() => setRunId((n) => n + 1)}
    />
  );
}

function AdvisorScreen({
  knowledgeCards,
  onReplay,
}: {
  knowledgeCards: PublicCard[];
  onReplay: () => void;
}) {
  const [corrections, setCorrections] = useState<CorrectionCard[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [drawerCardId, setDrawerCardId] = useState<string | null>(null);

  const sourcesById = useMemo(
    () => cardsById([...MOCK_KNOWLEDGE_CARDS, ...knowledgeCards]),
    [knowledgeCards],
  );

  // Run the §10 timed mock driver once on mount (replay remounts via the key).
  useEffect(() => {
    const timers = DEMO_SCRIPT.map((e) =>
      setTimeout(() => {
        if (e.kind === "correction") {
          setCorrections((prev) =>
            prev.some((c) => c.id === e.correction.id)
              ? prev
              : [...prev, { ...e.correction, createdAt: new Date().toISOString() }],
          );
        } else if (e.kind === "note") {
          setNotes((prev) => [
            ...prev,
            { id: `note-${e.t}`, createdAt: Date.now(), text: e.text },
          ]);
        } else if (e.kind === "openSource") {
          setDrawerCardId(e.cardId);
        } else {
          setDrawerCardId(null);
        }
      }, e.t * 1000),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const addNote = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setNotes((prev) => [
      ...prev,
      { id: `note-${Date.now()}`, createdAt: Date.now(), text: trimmed },
    ]);
  }, []);

  const openSource = useCallback((cardId: string) => setDrawerCardId(cardId), []);
  const closeSource = useCallback(() => setDrawerCardId(null), []);

  const drawerOpen = drawerCardId !== null;
  const drawerCard = drawerCardId ? sourcesById.get(drawerCardId) ?? null : null;

  return (
    <div className="h-[42rem] rounded-xl bg-[#f4f3ee] p-3 text-[#1c1c1a]">
      <div className="flex h-full gap-2">
        {/* Left column ~58% — Corrections + Source drawer */}
        <div className="flex min-w-0 flex-[58] flex-col gap-2">
          <Panel
            label="Corrections"
            className="flex min-h-0 flex-1 flex-col"
            action={
              <button
                type="button"
                onClick={onReplay}
                className="text-[11px] font-[450] text-[#8a897f] hover:text-[#5f5e5a]"
              >
                ↻ replay
              </button>
            }
          >
            <CorrectionsFeed
              corrections={corrections}
              sourcesById={sourcesById}
              activeCardId={drawerCardId}
              onOpenSource={openSource}
            />
          </Panel>

          {/* Source drawer — in-column expand/collapse below Corrections (§5). */}
          <div
            aria-hidden={!drawerOpen}
            style={{ height: drawerOpen ? "50%" : 0, opacity: drawerOpen ? 1 : 0 }}
            className="overflow-hidden transition-[height,opacity] duration-[350ms] ease-out"
          >
            {drawerCard && <SourceDrawer card={drawerCard} onClose={closeSource} />}
          </div>
        </div>

        {/* Right column ~42% — Personal notes (large) + two placeholders */}
        <div className="flex min-w-[320px] flex-[42] flex-col gap-2">
          <Panel label="Personal notes" className="flex min-h-0 flex-[72] flex-col">
            <PersonalNotes notes={notes} onAdd={addNote} />
          </Panel>
          <Placeholder label="Chat w/ Vesper" className="flex-[14]" />
          <Placeholder label="Next topics" className="flex-[14]" />
        </div>
      </div>
    </div>
  );
}

// ── Corrections feed (§4) ──────────────────────────────────────────────────────

function CorrectionsFeed({
  corrections,
  sourcesById,
  activeCardId,
  onOpenSource,
}: {
  corrections: CorrectionCard[];
  sourcesById: Map<string, SourceCard>;
  activeCardId: string | null;
  onOpenSource: (cardId: string) => void;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  // Newest populates at the BOTTOM (§4) — keep it in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [corrections.length]);

  if (corrections.length === 0) {
    return (
      <p className="m-auto max-w-[18rem] text-center text-[13px] font-[400] text-[#8a897f]">
        Listening. If you state something the docs contradict, the correction
        appears here.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-y-auto pr-1">
      {corrections.map((c, i) => (
        <CorrectionItem
          key={c.id}
          correction={c}
          isNewest={i === corrections.length - 1}
          sourcesById={sourcesById}
          activeCardId={activeCardId}
          onOpenSource={onOpenSource}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function CorrectionItem({
  correction,
  isNewest,
  sourcesById,
  activeCardId,
  onOpenSource,
}: {
  correction: CorrectionCard;
  isNewest: boolean;
  sourcesById: Map<string, SourceCard>;
  activeCardId: string | null;
  onOpenSource: (cardId: string) => void;
}) {
  // Soft fade-in to the item's target opacity (1 newest, 0.55 older). When a newer
  // correction arrives this transitions 1 → 0.55 — grey-then-fade, never abrupt (§8).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);
  const target = isNewest ? 1 : 0.55;

  const sources = correction.sourceCardIds
    .map((id) => sourcesById.get(id))
    .filter((c): c is SourceCard => Boolean(c));

  return (
    <div
      style={{ opacity: mounted ? target : 0 }}
      className={`shrink-0 rounded-lg border p-3 transition-opacity duration-[250ms] ${
        isNewest
          ? "border-[#ba7517] bg-[#faeeda]"
          : "border-[rgba(0,0,0,0.12)] bg-[#ffffff]"
      }`}
    >
      <p
        className={`text-[15px] font-[450] ${
          isNewest ? "text-[#854f0b]" : "text-[#1c1c1a]"
        }`}
      >
        {correction.suggestedCorrection}
      </p>
      {correction.repStatement && (
        <p className="mt-1 text-[13px] font-[400] text-[#8a897f]">
          you said:{" "}
          <span className="line-through">{correction.repStatement}</span>
        </p>
      )}
      {sources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sources.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpenSource(s.id)}
              className={`rounded-md border px-2 py-0.5 text-[11px] font-[450] transition-colors ${
                activeCardId === s.id
                  ? "border-[#378add] bg-[#e6f1fb] text-[#185fa5]"
                  : "border-[rgba(0,0,0,0.12)] bg-[#ffffff] text-[#5f5e5a] hover:border-[#378add] hover:text-[#185fa5]"
              }`}
            >
              {s.title} ›
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Source drawer (§5) ───────────────────────────────────────────────────────

function SourceDrawer({
  card,
  onClose,
}: {
  card: SourceCard;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-[rgba(0,0,0,0.12)] bg-[#ffffff] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-[450] tracking-wide text-[#8a897f]">
            Source
          </p>
          <p className="truncate text-[13px] font-[450] text-[#1c1c1a]">
            {card.title} · {card.source}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close source"
          className="shrink-0 rounded-md border border-[rgba(0,0,0,0.12)] px-2 py-0.5 text-[13px] font-[400] text-[#5f5e5a] hover:text-[#1c1c1a]"
        >
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-[13px] font-[400] leading-relaxed text-[#5f5e5a]">
        {card.text}
      </div>
    </div>
  );
}

// ── Personal notes (§6) ──────────────────────────────────────────────────────

function PersonalNotes({
  notes,
  onAdd,
}: {
  notes: Note[];
  onAdd: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [notes.length]);

  const submit = () => {
    onAdd(draft);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-1 overflow-y-auto pr-1">
        {notes.length === 0 ? (
          <p className="text-[13px] font-[400] text-[#8a897f]">
            Jot quick notes — they stay private.
          </p>
        ) : (
          notes.map((n) => (
            <p key={n.id} className="text-[13px] font-[400] text-[#1c1c1a]">
              {n.text}
            </p>
          ))
        )}
        <div ref={endRef} />
      </div>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="competitor: …  ·  follow up: …"
        className="mt-2 w-full rounded-md border border-[rgba(0,0,0,0.12)] bg-[#ffffff] px-2 py-1.5 text-[13px] font-[400] text-[#1c1c1a] placeholder:text-[#8a897f] focus:border-[#378add] focus:outline-none"
      />
    </div>
  );
}

// ── Inert placeholders (§7) ──────────────────────────────────────────────────

function Placeholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border border-[rgba(0,0,0,0.12)] bg-[#ffffff] px-3 py-2 ${className}`}
    >
      <span className="text-[11px] font-[450] tracking-wide text-[#5f5e5a]">
        {label}
      </span>
      <span className="text-[11px] font-[400] text-[#8a897f]">coming soon</span>
    </div>
  );
}

// ── Panel shell ──────────────────────────────────────────────────────────────

function Panel({
  label,
  action,
  className = "",
  children,
}: {
  label: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-[rgba(0,0,0,0.12)] bg-[#ffffff] p-3 ${className}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-[450] tracking-wide text-[#8a897f]">
          {label}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
