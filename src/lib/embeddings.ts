// Traces to: spec/product.md §9 (retrieval) + workstreams.md Lane A.
//
// Embeddings via OpenAI `text-embedding-3-small`. Server-only (uses OPENAI_API_KEY).

import OpenAI from "openai";
import { getOpenAiApiKey } from "@/lib/env";

const EMBEDDING_MODEL = "text-embedding-3-small";
// Stay well under OpenAI's per-request input/token limits; large docs (e.g. a
// 140-page PDF → ~1400 chunks) must be embedded in batches, not one request.
const BATCH_SIZE = 128;

// Embeds texts. Returns one vector per input, in input order. Batches large
// inputs across multiple requests.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = new OpenAI({ apiKey: getOpenAiApiKey() });
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    // Sort by index so order is guaranteed regardless of API ordering.
    const sorted = [...response.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) out.push(item.embedding);
  }
  return out;
}

// Embeds a single query string. Final — do not change.
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}
