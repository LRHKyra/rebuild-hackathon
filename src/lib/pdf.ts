// Traces to: plan (real ingestion: text/md/pdf) + workstreams.md Lane A.
//
// Extracts plain text from a PDF using unpdf (pure-JS, serverless-friendly).
// Server-only. The extracted text then flows through the normal ingestion path
// (chunk → embed → store), so PDFs are treated like any other source.

import { extractText } from "unpdf";

// Returns the full text of a PDF given its bytes. Throws on an unreadable PDF.
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { text } = await extractText(bytes, { mergePages: true });
  return text.trim();
}
