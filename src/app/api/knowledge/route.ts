// Traces to: spec/product.md §13 (POST/GET /api/knowledge) + §6A + Lane A.
//
// POST: turn pasted/uploaded text into chunked, embedded KnowledgeCards.
// GET:  list cards for a company. Embeddings are never returned to the client.

import { NextResponse } from "next/server";
import { chunkText } from "@/lib/chunk";
import { embedTexts } from "@/lib/embeddings";
import { getStore } from "@/lib/store";
import { MissingEnvError } from "@/lib/env";
import type { KnowledgeCard } from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_COMPANY = "demo-company";

type PublicCard = Omit<KnowledgeCard, "embedding">;

function publicCard(card: KnowledgeCard): PublicCard {
  return {
    id: card.id,
    companyId: card.companyId,
    title: card.title,
    source: card.source,
    topicTags: card.topicTags,
    text: card.text,
    createdAt: card.createdAt,
  };
}

export async function GET(request: Request) {
  const companyId =
    new URL(request.url).searchParams.get("companyId") ?? DEFAULT_COMPANY;
  const cards = await getStore().list(companyId);
  return NextResponse.json({ cards: cards.map(publicCard) });
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
  const companyId =
    typeof body.companyId === "string" && body.companyId.trim()
      ? body.companyId.trim()
      : DEFAULT_COMPANY;
  const title = typeof body.title === "string" ? body.title.trim() : "Untitled";
  const source = typeof body.source === "string" ? body.source.trim() : title;
  const topicTags = Array.isArray(body.topicTags)
    ? body.topicTags.filter((t): t is string => typeof t === "string")
    : [];

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return NextResponse.json({ error: "No content to ingest." }, { status: 400 });
  }

  try {
    const embeddings = await embedTexts(chunks);
    const createdAt = new Date().toISOString();
    const cards: KnowledgeCard[] = chunks.map((chunk, i) => ({
      id: crypto.randomUUID(),
      companyId,
      title,
      source,
      topicTags,
      text: chunk,
      embedding: embeddings[i],
      createdAt,
    }));
    await getStore().add(cards);

    return NextResponse.json({
      cardsCreated: cards.length,
      cards: cards.map(publicCard),
    });
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error("[knowledge] missing env:", error.missing.join(", "));
      return NextResponse.json(
        { error: "Knowledge service is not configured on the server." },
        { status: 503 },
      );
    }
    console.error("[knowledge] ingestion failed:", error);
    return NextResponse.json(
      { error: "Could not ingest knowledge. Please try again." },
      { status: 502 },
    );
  }
}
