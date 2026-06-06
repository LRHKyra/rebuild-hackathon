// Minimal call driver — proves the brain answers REAL questions from a REAL doc.
// Nothing is hardcoded: you pass your own document and your own transcript lines.
//
// Usage:
//   npm run call-sim -- --doc ./path/to/realdoc.pdf --transcript ./path/to/lines.txt
// Options:
//   --doc <path>         a real .txt/.md/.pdf document to ingest
//   --transcript <path>  a file of transcript lines, one per line; each line may be
//                        prefixed "rep:" / "prospect:" (default speaker: unknown).
//                        A line containing "Vesper" is treated as a summon.
//   --base <url>         server base (default http://localhost:3000)
//   --company <id>       company id (default demo-company)
//   --call <id>          call id (default sim-call)
//
// Requires the dev server running with real ANTHROPIC_API_KEY + OPENAI_API_KEY.

import { readFile, stat, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

// Resolves --doc (a file, a directory, or a comma-separated list) into a flat
// list of ingestible files (.txt/.md/.pdf).
async function resolveDocs(docArg) {
  const parts = docArg.split(",").map((s) => s.trim()).filter(Boolean);
  const files = [];
  for (const p of parts) {
    const st = await stat(p);
    if (st.isDirectory()) {
      for (const entry of await readdir(p)) {
        if (/\.(txt|md|pdf)$/i.test(entry)) files.push(join(p, entry));
      }
    } else {
      files.push(p);
    }
  }
  return files;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (key) args[key] = argv[i + 1];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const base = (args.base ?? "http://localhost:3000").replace(/\/$/, "");
const companyId = args.company ?? "demo-company";
const callId = args.call ?? "sim-call";

if (!args.doc || !args.transcript) {
  console.error(
    "Usage: npm run call-sim -- --doc <file.txt|md|pdf> --transcript <lines.txt>",
  );
  process.exit(1);
}

async function main() {
  // 1) Ingest the real document(s) via the upload path.
  const docs = await resolveDocs(args.doc);
  if (docs.length === 0) {
    console.error(`No .txt/.md/.pdf files found at ${args.doc}`);
    process.exit(1);
  }
  console.log(`\n📥 Ingesting ${docs.length} document(s) …`);
  let totalCards = 0;
  for (const doc of docs) {
    const docBytes = await readFile(doc);
    const form = new FormData();
    form.append("file", new Blob([docBytes]), basename(doc));
    form.append("companyId", companyId);
    form.append("title", basename(doc));
    const ingestRes = await fetch(`${base}/api/knowledge`, {
      method: "POST",
      body: form,
    });
    const ingestBody = await ingestRes.json().catch(() => ({}));
    if (!ingestRes.ok) {
      console.error(`   ✗ ${basename(doc)} failed (HTTP ${ingestRes.status}): ${ingestBody.error ?? ""}`);
      if (ingestRes.status === 503) console.error("   → set real ANTHROPIC_API_KEY + OPENAI_API_KEY in .env.local");
      process.exit(1);
    }
    console.log(`   ✓ ${basename(doc)} → ${ingestBody.cardsCreated} card(s)`);
    totalCards += ingestBody.cardsCreated ?? 0;
  }
  console.log(`   total: ${totalCards} knowledge card(s)`);

  // Build an id → title map so we can show which cards were cited.
  const listRes = await fetch(`${base}/api/knowledge?companyId=${encodeURIComponent(companyId)}`);
  const list = await listRes.json().catch(() => ({ cards: [] }));
  const titleById = new Map((list.cards ?? []).map((c) => [c.id, c.title]));
  const titlesFor = (ids = []) =>
    ids.map((id) => titleById.get(id) ?? id).join(", ") || "(none)";

  // 2) Replay the real transcript through the call-analysis loop.
  const raw = await readFile(args.transcript, "utf8");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  console.log(`\n🎙️  Replaying ${lines.length} transcript line(s):\n`);
  for (const line of lines) {
    const m = line.match(/^(rep|prospect|unknown):\s*(.*)$/i);
    const speaker = m ? m[1].toLowerCase() : "unknown";
    const text = m ? m[2] : line;

    console.log(`[${speaker}] ${text}`);
    const res = await fetch(`${base}/api/call/transcript`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callId, companyId, speaker, text }),
    });
    const a = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log(`   ✗ HTTP ${res.status}: ${a.error ?? ""}\n`);
      continue;
    }

    if (a.isWake) {
      if (a.summon) {
        console.log(`   🔔 SUMMON → would speak: "${a.summon.answer}"`);
      } else {
        console.log("   🔔 SUMMON → no answer ready to speak");
      }
    }
    if (a.detectedQuestion) {
      console.log(`   ❓ detected: "${a.detectedQuestion.question}"`);
    }
    if (a.answerCard) {
      const c = a.answerCard;
      console.log(
        `   💬 answer (${c.confidence}, canSpeak=${c.canSpeak}): ${c.answer}`,
      );
      console.log(`      sources: ${titlesFor(c.sourceCardIds)}`);
    }
    if (a.correctionCard) {
      const c = a.correctionCard;
      console.log(`   ⚠️  contradiction (${c.severity}): ${c.issue}`);
      console.log(`      correction: ${c.suggestedCorrection}`);
    }
    if (!a.isWake && !a.detectedQuestion && !a.correctionCard) {
      console.log("   · (no action)");
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error("call-sim failed:", err);
  process.exit(1);
});
