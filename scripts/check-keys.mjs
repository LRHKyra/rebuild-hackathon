// Confirms ANTHROPIC_API_KEY + OPENAI_API_KEY work against the exact models we use.
// Makes tiny real calls. Never prints key values.
//   node --env-file=.env.local scripts/check-keys.mjs

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

function errMsg(e) {
  return `${e?.status ?? ""} ${e?.name ?? ""}: ${e?.message ?? e}`.trim();
}

async function checkAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, msg: "ANTHROPIC_API_KEY not set" };
  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 5,
      messages: [{ role: "user", content: "Reply with the word: ok" }],
    });
    const text = res.content.find((b) => b.type === "text")?.text ?? "";
    return { ok: true, msg: `model=${res.model}, reply=${JSON.stringify(text.trim())}` };
  } catch (e) {
    return { ok: false, msg: errMsg(e) };
  }
}

async function checkOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, msg: "OPENAI_API_KEY not set" };
  try {
    const client = new OpenAI({ apiKey: key });
    const res = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: "ping",
    });
    const dims = res.data?.[0]?.embedding?.length ?? 0;
    return { ok: true, msg: `model=${res.model}, dims=${dims}` };
  } catch (e) {
    return { ok: false, msg: errMsg(e) };
  }
}

const [a, o] = await Promise.all([checkAnthropic(), checkOpenAI()]);
console.log(`Anthropic (claude-haiku-4-5):     ${a.ok ? "✅ OK" : "❌ FAIL"} — ${a.msg}`);
console.log(`OpenAI (text-embedding-3-small):  ${o.ok ? "✅ OK" : "❌ FAIL"} — ${o.msg}`);
process.exit(a.ok && o.ok ? 0 : 1);
