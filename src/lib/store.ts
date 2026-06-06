// Traces to: spec/product.md §7 (storage) + workstreams.md Lane A.
//
// In-memory vector store, seeded at runtime from ingested knowledge. This is the
// simplest real-RAG store at demo scale (~10-30 cards) and works on Vercel.
// Everything goes through the KnowledgeStore interface so it can be swapped for
// Supabase/pgvector later without touching callers (principles.md decision).

import type { KnowledgeCard, RetrievedCard } from "@/types";

export interface KnowledgeStore {
  // Adds cards (each should already carry its `embedding`).
  add(cards: KnowledgeCard[]): Promise<void>;
  // Lists cards, optionally filtered by company.
  list(companyId?: string): Promise<KnowledgeCard[]>;
  // Returns the top-K cards for a company by cosine similarity to the query vector.
  search(
    companyId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<RetrievedCard[]>;
  // Clears cards (all, or for one company). Used by tests/reseeding.
  clear(companyId?: string): Promise<void>;
}

class InMemoryKnowledgeStore implements KnowledgeStore {
  private cards: KnowledgeCard[] = [];

  async add(cards: KnowledgeCard[]): Promise<void> {
    // Immutable update — never mutate the existing array in place.
    this.cards = [...this.cards, ...cards];
  }

  async list(companyId?: string): Promise<KnowledgeCard[]> {
    const all = this.cards;
    return companyId ? all.filter((c) => c.companyId === companyId) : [...all];
  }

  async search(
    companyId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<RetrievedCard[]> {
    const scored = this.cards
      .filter((c) => c.companyId === companyId && c.embedding?.length)
      .map((card) => ({
        card,
        score: cosineSimilarity(queryEmbedding, card.embedding as number[]),
      }))
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, Math.max(0, topK));
  }

  async clear(companyId?: string): Promise<void> {
    this.cards = companyId
      ? this.cards.filter((c) => c.companyId !== companyId)
      : [];
  }
}

// Cosine similarity. Returns 0 for mismatched/empty vectors rather than throwing.
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Module-level singleton so all routes share one store within a server instance.
let store: KnowledgeStore | null = null;

export function getStore(): KnowledgeStore {
  if (!store) store = new InMemoryKnowledgeStore();
  return store;
}
