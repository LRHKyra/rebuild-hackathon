// Traces to: spec/product.md §6C (wake-word handoff) + plan (call contract).
//
// Detects when Vesper is summoned by name in a transcript line. Gating is by name
// from ANYONE on the call (no speaker diarization) — product.md §6C.

const DEFAULT_AGENT_NAME = "Vesper";

// True if the line addresses the agent by name (e.g. "Vesper, can you take that one?").
export function detectWakeWord(text: string, agentName = DEFAULT_AGENT_NAME): boolean {
  const re = new RegExp(`\\b${escapeRegExp(agentName)}\\b`, "i");
  return re.test(text);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
