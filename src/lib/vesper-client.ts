// Traces to: spec/product.md §13 (API contracts). Lane C owns this file.
//
// Client-side consumers of the frozen seams. This is the ONLY place the workspace
// UI talks to the backend, so swapping mock -> live is a one-file concern. No
// secrets here — these call our own server routes, which hold the keys.
//
// What is live today: Lane A's POST/GET /api/knowledge and POST /api/answer.
// What is not yet built: Lane B's POST /api/call/transcript and POST /api/summon —
// callers detect that and fall back to the demo-safe mock path.

import type { AnswerCard, KnowledgeCard, TranscriptAnalysis } from "@/types";
import { DEMO_COMPANY_ID } from "@/lib/fixtures";

type PublicCard = Omit<KnowledgeCard, "embedding">;

// Thrown when a route Lane B hasn't built yet returns 404/405. Callers use this to
// decide whether to fall back to mock data rather than surfacing a hard error.
export class RouteNotImplementedError extends Error {}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // non-JSON body
  }
  return `${fallback} (status ${res.status}).`;
}

// ── Knowledge (Lane A, live) ────────────────────────────────────────────────

export async function listKnowledge(
  companyId = DEMO_COMPANY_ID,
): Promise<PublicCard[]> {
  const res = await fetch(
    `/api/knowledge?companyId=${encodeURIComponent(companyId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(await errorMessage(res, "Could not load knowledge"));
  const data = (await res.json()) as { cards?: PublicCard[] };
  return data.cards ?? [];
}

export type AddKnowledgeInput = {
  companyId?: string;
  title: string;
  source: string;
  text: string;
  topicTags?: string[];
};

export async function addKnowledge(
  input: AddKnowledgeInput,
): Promise<{ cardsCreated: number; cards: PublicCard[] }> {
  const res = await fetch("/api/knowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId: DEMO_COMPANY_ID, ...input }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Could not add knowledge"));
  return (await res.json()) as { cardsCreated: number; cards: PublicCard[] };
}

// Uploads a binary document (PDF) for server-side parsing. Sent as
// multipart/form-data — the assumed Lane A file-ingestion contract — because the
// browser can't reliably extract PDF text. Lane A parses the file to text, then
// chunks + embeds it exactly like pasted text. (Text files don't use this path;
// they go through addKnowledge as JSON.)
export async function addKnowledgeFile(input: {
  file: File;
  title: string;
  source: string;
  companyId?: string;
}): Promise<{ cardsCreated: number; cards: PublicCard[] }> {
  const form = new FormData();
  form.append("companyId", input.companyId ?? DEMO_COMPANY_ID);
  form.append("title", input.title);
  form.append("source", input.source);
  form.append("file", input.file, input.file.name);
  // No Content-Type header: the browser sets the multipart boundary.
  const res = await fetch("/api/knowledge", { method: "POST", body: form });
  if (!res.ok) throw new Error(await errorMessage(res, "Could not ingest file"));
  return (await res.json()) as { cardsCreated: number; cards: PublicCard[] };
}

// ── Grounded answer (Lane A, live) ──────────────────────────────────────────

export async function askAnswer(input: {
  callId: string;
  question: string;
  questionId?: string;
  companyId?: string;
}): Promise<AnswerCard> {
  const res = await fetch("/api/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId: DEMO_COMPANY_ID, ...input }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Could not get an answer"));
  return (await res.json()) as AnswerCard;
}

// ── Transcript analysis (Lane B, not yet built) ─────────────────────────────

export async function analyzeTranscript(input: {
  callId: string;
  speaker: string;
  text: string;
}): Promise<TranscriptAnalysis> {
  const res = await fetch("/api/call/transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 404 || res.status === 405) {
    throw new RouteNotImplementedError("transcript route not implemented");
  }
  if (!res.ok) throw new Error(await errorMessage(res, "Analysis failed"));
  return (await res.json()) as TranscriptAnalysis;
}

// ── Summon -> spoken audio ──────────────────────────────────────────────────
// Prefers Lane B's /api/summon (it picks/regenerates the current answer). If that
// route isn't built yet, falls back to /api/tts with the supplied spokenText so
// the audible "wow" still works in the demo.

export async function summonSpeak(input: {
  callId: string;
  wakePhrase: string;
  fallbackText: string;
}): Promise<{ audio: Blob; spokenText: string }> {
  let res: Response | null = null;
  try {
    res = await fetch("/api/summon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId: input.callId, wakePhrase: input.wakePhrase }),
    });
  } catch {
    res = null;
  }

  if (res && res.ok) {
    const spokenText =
      res.headers.get("x-spoken-text") ?? input.fallbackText;
    return { audio: await res.blob(), spokenText };
  }

  // Fallback: synthesize the answer we already have via the voice core's TTS route.
  const tts = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: input.fallbackText }),
  });
  if (!tts.ok) throw new Error(await errorMessage(tts, "Could not synthesize speech"));
  return { audio: await tts.blob(), spokenText: input.fallbackText };
}
