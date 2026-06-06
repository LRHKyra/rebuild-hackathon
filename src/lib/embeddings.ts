// Traces to: spec/product.md §9 (retrieval) + workstreams.md Lane A.
//
// Embeddings via OpenAI `text-embedding-3-small`. Server-only (uses OPENAI_API_KEY).
//
// ── STUB (frozen interface) ─────────────────────────────────────────────────
// The signature below is the frozen seam. A parallel agent replaces ONLY the body
// of `embedTexts` with the real OpenAI call. `embedQuery` is final. Until then,
// this returns deterministic mock vectors so the app builds and runs offline.

const MOCK_DIM = 64;

// Embeds a batch of texts. Returns one vector per input, in order.
// AGENT: replace this body with OpenAI text-embedding-3-small via the `openai` SDK.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  return texts.map(mockEmbed);
}

// Embeds a single query string. Final — do not change.
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}

// Deterministic placeholder embedding so retrieval is non-random without a key.
function mockEmbed(text: string): number[] {
  const vector = new Array<number>(MOCK_DIM).fill(0);
  const normalized = text.toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    vector[i % MOCK_DIM] += normalized.charCodeAt(i) % 13;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}
