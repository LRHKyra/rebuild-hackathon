// Traces to: spec/product.md §9 (retrieval) + workstreams.md Lane A.
//
// Embeddings via OpenAI `text-embedding-3-small`. Server-only (uses OPENAI_API_KEY).

import OpenAI from "openai";
import { getOpenAiApiKey } from "@/lib/env";

const EMBEDDING_MODEL = "text-embedding-3-small";

// Embeds a batch of texts. Returns one vector per input, in order.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = new OpenAI({ apiKey: getOpenAiApiKey() });
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map((item) => item.embedding);
}

// Embeds a single query string. Final — do not change.
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}
