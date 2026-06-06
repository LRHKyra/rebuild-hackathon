// Traces to: spec/product.md §9 (retrieval contract) + workstreams.md Lane A.
//
// Glue: embed the query, then vector-search the store. Final implementation —
// depends only on the embeddings + store interfaces, so it was safe to write in
// the foundation.

import { embedQuery } from "@/lib/embeddings";
import { getStore } from "@/lib/store";
import type { RetrievedCard } from "@/types";

const DEFAULT_TOP_K = 5;

// Returns the top-K knowledge cards for a query, most similar first.
export async function retrieve(params: {
  companyId: string;
  query: string;
  topK?: number;
}): Promise<RetrievedCard[]> {
  const { companyId, query, topK = DEFAULT_TOP_K } = params;
  if (!query.trim()) return [];
  const queryEmbedding = await embedQuery(query);
  return getStore().search(companyId, queryEmbedding, topK);
}
