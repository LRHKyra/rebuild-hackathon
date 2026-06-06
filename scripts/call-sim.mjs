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
//   --verbose, --debug   show the raw LLM I/O (detectQuestion, retrieved cards,
//                        generateAnswer, detectContradiction, token usage)
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

// Boolean flags take no value (present = on); everything else is a key/value pair.
const BOOLEAN_FLAGS = new Set(["verbose", "debug"]);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]?.replace(/^--/, "");
    if (!key || argv[i]?.[0] !== "-") continue;
    if (BOOLEAN_FLAGS.has(key)) {
      args[key] = true;
    } else {
      args[key] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const base = (args.base ?? "http://localhost:3000").replace(/\/$/, "");
const companyId = args.company ?? "demo-company";
const callId = args.call ?? "sim-call";
const verbose = Boolean(args.verbose || args.debug);

if (!args.doc || !args.transcript) {
  console.error(
    "Usage: npm run call-sim -- --doc <file.txt|md|pdf> --transcript <lines.txt>",
  );
  process.exit(1);
}

// Pretty-prints the server's debug payload under an indented "🔎 debug" header.
// Every field is optional (older server shapes omit them), so each access is guarded.
function printDebug(debug) {
  if (!debug || typeof debug !== "object") return;
  const has = (v) => v !== undefined && v !== null;
  const fmt = (v) =>
    typeof v === "string" ? v : JSON.stringify(v);

  console.log("   🔎 debug");

  // detectQuestion result
  const d = debug.detect;
  if (has(d) && typeof d === "object") {
    console.log("      detectQuestion:");
    if (has(d.hasQuestion)) console.log(`         hasQuestion: ${fmt(d.hasQuestion)}`);
    if (has(d.question)) console.log(`         question: ${fmt(d.question)}`);
    if (has(d.category)) console.log(`         category: ${fmt(d.category)}`);
    if (has(d.urgency)) console.log(`         urgency: ${fmt(d.urgency)}`);
  }

  // retrieved cards: "title  score", sorted by score desc
  const retrieved = debug.retrieved;
  if (Array.isArray(retrieved) && retrieved.length > 0) {
    console.log("      retrieved:");
    const sorted = [...retrieved].sort(
      (a, b) => (b?.score ?? 0) - (a?.score ?? 0),
    );
    for (const card of sorted) {
      const title = has(card?.title) ? card.title : "(untitled)";
      const score = has(card?.score) ? card.score : "?";
      console.log(`         ${title}  ${score}`);
    }
  }

  // raw generateAnswer output
  const ans = debug.answer;
  if (has(ans) && typeof ans === "object") {
    console.log("      generateAnswer:");
    if (has(ans.spokenAnswer)) console.log(`         spokenAnswer: ${fmt(ans.spokenAnswer)}`);
    if (has(ans.rawCanSpeak)) console.log(`         canSpeak (model raw): ${fmt(ans.rawCanSpeak)}`);
    if (has(ans.finalCanSpeak)) console.log(`         canSpeak (route final): ${fmt(ans.finalCanSpeak)}`);
    // Surface any remaining fields we didn't explicitly call out.
    for (const [k, v] of Object.entries(ans)) {
      if (["spokenAnswer", "rawCanSpeak", "finalCanSpeak"].includes(k)) continue;
      console.log(`         ${k}: ${fmt(v)}`);
    }
  }

  // detectContradiction result — printed even when false
  const con = debug.contradiction;
  if (has(con) && typeof con === "object") {
    console.log("      detectContradiction:");
    if (has(con.isCheckableClaim)) console.log(`         isCheckableClaim: ${fmt(con.isCheckableClaim)}`);
    if (has(con.hasContradiction)) console.log(`         hasContradiction: ${fmt(con.hasContradiction)}`);
    for (const [k, v] of Object.entries(con)) {
      if (["isCheckableClaim", "hasContradiction"].includes(k)) continue;
      console.log(`         ${k}: ${fmt(v)}`);
    }
  }

  // contradiction gating decision (why we did / didn't check)
  const gating = debug.gating;
  if (has(gating) && typeof gating === "object") {
    console.log(`      gating: ${fmt(gating)}`);
  }

  // token usage
  const usage = debug.usage;
  if (has(usage)) {
    console.log(`      usage: ${fmt(usage)}`);
  }
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
    const transcriptUrl = `${base}/api/call/transcript${verbose ? "?debug=1" : ""}`;
    const res = await fetch(transcriptUrl, {
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
        // Speak the natural, no-markdown spoken version (what TTS actually says).
        const spoken = a.summon.spokenAnswer ?? a.summon.answer;
        console.log(`   🔔 SUMMON → would speak: "${spoken}"`);
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
    if (verbose && a.debug) printDebug(a.debug);
    console.log("");
  }
}

main().catch((err) => {
  console.error("call-sim failed:", err);
  process.exit(1);
});
