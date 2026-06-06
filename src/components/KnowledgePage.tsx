"use client";

// Traces to: spec/product.md §6A (knowledge setup page) + §13 (POST/GET /api/knowledge).
// Lane C owns this file. The setup screen that makes Vesper feel like a reusable
// product: upload documents (PDF / .md / .txt) — by drag-and-drop or the file
// picker — to populate the knowledge base, plus a one-click AcmeFlow sample for
// demo safety. Uploaded cards render in a table with title, source, and preview.
//
// Ingestion (both hit POST /api/knowledge):
//   - .md / .txt: read to text in the browser, sent as JSON { title, source, text }
//     — the current Lane A contract, works today.
//   - .pdf: sent as multipart/form-data (file field) for Lane A to parse server-side.
// title/source are derived from each file's name.

import { useCallback, useRef, useState } from "react";
import type { KnowledgeCard } from "@/types";
import { ACMEFLOW_DOCS } from "@/lib/fixtures";
import { addKnowledge, addKnowledgeFile } from "@/lib/vesper-client";

type PublicCard = Omit<KnowledgeCard, "embedding">;

type KnowledgePageProps = {
  agentName: string;
  cards: PublicCard[];
  onCardsChanged: () => Promise<void> | void;
};

const ACCEPT = ".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain";
const TEXT_EXT = /\.(md|markdown|txt)$/i;
const PDF_EXT = /\.pdf$/i;

// Derive the card title/source from a filename (the title/source fields are gone).
function titleFor(name: string): string {
  return name.replace(/\.[^.]+$/, "") || name;
}

export function KnowledgePage({
  agentName,
  cards,
  onCardsChanged,
}: KnowledgePageProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const ingestFiles = useCallback(
    async (files: File[]) => {
      const docs = files.filter(
        (f) => TEXT_EXT.test(f.name) || PDF_EXT.test(f.name),
      );
      const skipped = files.length - docs.length;
      if (docs.length === 0) {
        setError("Unsupported file type. Upload PDF, .md, or .txt documents.");
        return;
      }

      setBusy(true);
      setError(null);
      setStatus(null);
      let created = 0;
      const failures: string[] = [];

      for (const file of docs) {
        const title = titleFor(file.name);
        try {
          if (PDF_EXT.test(file.name)) {
            const res = await addKnowledgeFile({ file, title, source: file.name });
            created += res.cardsCreated;
          } else {
            const text = (await file.text()).trim();
            if (!text) {
              failures.push(`${file.name} (empty)`);
              continue;
            }
            const res = await addKnowledge({ title, source: file.name, text });
            created += res.cardsCreated;
          }
        } catch (e) {
          failures.push(`${file.name} (${e instanceof Error ? e.message : "failed"})`);
        }
      }

      const parts: string[] = [];
      if (created > 0) parts.push(`Added ${created} knowledge card(s).`);
      if (skipped > 0) parts.push(`Skipped ${skipped} unsupported file(s).`);
      setStatus(parts.join(" ") || null);
      if (failures.length > 0) {
        setError(`Could not ingest: ${failures.join("; ")}`);
      }
      await onCardsChanged();
      setBusy(false);
    },
    [onCardsChanged],
  );

  const loadSample = useCallback(async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      let created = 0;
      for (const doc of ACMEFLOW_DOCS) {
        const res = await addKnowledge({
          title: doc.title,
          source: doc.source,
          text: doc.text,
          topicTags: doc.topicTags,
        });
        created += res.cardsCreated;
      }
      setStatus(`Loaded the AcmeFlow sample — ${created} knowledge card(s).`);
      await onCardsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [onCardsChanged]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) void ingestFiles(files);
    },
    [ingestFiles],
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-lg font-semibold">Knowledge setup</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Upload documents to load {agentName} with product knowledge. This is what
          makes it reusable across any company or expert role — no code changes.
        </p>

        {/* Drag-and-drop / click upload zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload documents"
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
            dragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
              : "border-gray-300 hover:border-gray-400 dark:border-gray-600"
          } ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <span aria-hidden className="text-2xl">
            📄
          </span>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {busy ? "Processing…" : "Drag & drop documents here, or click to upload"}
          </p>
          <p className="text-xs text-gray-500">PDF, Markdown (.md), or plain text (.txt)</p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) void ingestFiles(files);
            e.target.value = "";
          }}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Upload files
          </button>
          <button
            type="button"
            onClick={loadSample}
            disabled={busy}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 disabled:opacity-40 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          >
            Load AcmeFlow sample
          </button>
        </div>

        {status && (
          <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
            {status}
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          >
            <p>{error}</p>
            <p className="mt-1 text-xs opacity-80">
              The rehearsed demo still runs in Mock mode on the Call screen even
              without a configured knowledge service.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide text-gray-700 uppercase dark:text-gray-300">
            Knowledge cards
          </h3>
          <span className="text-xs text-gray-500">{cards.length} card(s)</span>
        </div>
        {cards.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 italic">
            No cards yet. Upload a document or load the AcmeFlow sample.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-500 uppercase">
                <tr>
                  <th className="py-2 pr-3 font-medium">Title</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 font-medium">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {cards.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-gray-100">
                      {c.title}
                    </td>
                    <td className="py-2 pr-3 text-gray-500">{c.source}</td>
                    <td className="py-2 text-gray-600 dark:text-gray-300">
                      {c.text.length > 120 ? `${c.text.slice(0, 120)}…` : c.text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
