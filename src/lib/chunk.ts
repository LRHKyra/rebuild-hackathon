// Traces to: spec/product.md §6A (chunk into knowledge cards), workstreams.md Lane A.
//
// Deterministic, idea-agnostic chunking. Splits pasted/uploaded text into
// reasonably sized chunks on paragraph boundaries, packing paragraphs up to a
// target size so a single FAQ answer stays intact where possible.

const TARGET_CHARS = 800;
const MAX_CHARS = 1200;

// Splits text into chunks. Each chunk is trimmed and non-empty.
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Split on blank lines (paragraphs); fall back to the whole text.
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    // A single oversized paragraph is hard-split by sentence/length.
    if (paragraph.length > MAX_CHARS) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...hardSplit(paragraph));
      continue;
    }

    if (!current) {
      current = paragraph;
    } else if (current.length + paragraph.length + 2 <= TARGET_CHARS) {
      current = `${current}\n\n${paragraph}`;
    } else {
      chunks.push(current);
      current = paragraph;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

// Splits an oversized paragraph by sentence, packing up to MAX_CHARS.
function hardSplit(paragraph: string): string[] {
  const sentences = paragraph.match(/[^.!?]+[.!?]+|\S+$/g) ?? [paragraph];
  const out: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;
    if (!current) {
      current = piece;
    } else if (current.length + piece.length + 1 <= MAX_CHARS) {
      current = `${current} ${piece}`;
    } else {
      out.push(current);
      current = piece;
    }
  }
  if (current) out.push(current);
  return out;
}
