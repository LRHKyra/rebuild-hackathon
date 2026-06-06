// Traces to: spec/product.md §13 (POST/GET /api/knowledge) + §6A + plan (text/md/pdf).
//
// POST: turn pasted text OR an uploaded file (.txt/.md/.pdf) into chunked, embedded
// KnowledgeCards. GET: list cards for a company. Embeddings are never returned.

import { NextResponse } from "next/server";
import { chunkText } from "@/lib/chunk";
import { embedTexts } from "@/lib/embeddings";
import { extractPdfText } from "@/lib/pdf";
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

type IngestInput = {
  companyId: string;
  title: string;
  source: string;
  topicTags: string[];
  text: string;
};

// Shared pipeline: chunk → embed → store. Throws MissingEnvError if no key.
async function ingest(input: IngestInput) {
  const chunks = chunkText(input.text);
  if (chunks.length === 0) {
    return { ok: false as const, error: "No content to ingest." };
  }
  const embeddings = await embedTexts(chunks);
  const createdAt = new Date().toISOString();
  const cards: KnowledgeCard[] = chunks.map((chunk, i) => ({
    id: crypto.randomUUID(),
    companyId: input.companyId,
    title: input.title,
    source: input.source,
    topicTags: input.topicTags,
    text: chunk,
    embedding: embeddings[i],
    createdAt,
  }));
  await getStore().add(cards);
  return { ok: true as const, cardsCreated: cards.length, cards: cards.map(publicCard) };
}

export async function GET(request: Request) {
  const companyId =
    new URL(request.url).searchParams.get("companyId") ?? DEFAULT_COMPANY;
  const cards = await getStore().list(companyId);
  return NextResponse.json({ cards: cards.map(publicCard) });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    let input: IngestInput;

    if (contentType.includes("multipart/form-data")) {
      // File upload path (.txt / .md / .pdf).
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "A `file` field is required for uploads." },
          { status: 400 },
        );
      }
      const name = file.name || "upload";
      const bytes = new Uint8Array(await file.arrayBuffer());
      const isPdf =
        name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
      const text = isPdf
        ? await extractPdfText(bytes)
        : new TextDecoder().decode(bytes);
      input = {
        companyId: asString(form.get("companyId")) || DEFAULT_COMPANY,
        title: asString(form.get("title")) || name,
        source: asString(form.get("source")) || name,
        topicTags: [],
        text: text.trim(),
      };
    } else {
      // JSON paste path.
      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
      }
      const body = (payload ?? {}) as Record<string, unknown>;
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const title = typeof body.title === "string" ? body.title.trim() : "Untitled";
      input = {
        companyId:
          typeof body.companyId === "string" && body.companyId.trim()
            ? body.companyId.trim()
            : DEFAULT_COMPANY,
        title,
        source: typeof body.source === "string" ? body.source.trim() : title,
        topicTags: Array.isArray(body.topicTags)
          ? body.topicTags.filter((t): t is string => typeof t === "string")
          : [],
        text,
      };
    }

    if (!input.text) {
      return NextResponse.json(
        { error: "No text content found to ingest." },
        { status: 400 },
      );
    }

    const result = await ingest(input);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      cardsCreated: result.cardsCreated,
      cards: result.cards,
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

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}
