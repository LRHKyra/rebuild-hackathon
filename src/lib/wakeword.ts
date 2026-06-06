// Traces to: spec/product.md §6C (Voice Handoff) + workstreams.md Lane B.
//
// Wake-word matching is intentionally simple: no speaker identity, no meeting
// integration, just transcript text containing a natural way to bring in Vesper.

export type WakeWordMatch = {
  matched: boolean;
  wakePhrase?: string;
};

const WAKE_PATTERNS = [
  /\bvesper\b[\s,.:;!?-]*(can you|could you|would you|what'?s|take|answer|explain|help|jump in|join)/i,
  /\b(let me|i'?ll|we should)\s+(bring|pull|call)\s+in\s+vesper\b/i,
  /\bvesper\b[\s,.:;!?-]*(please\s+)?(take|answer|explain|help)/i,
];

export function detectWakeWord(text: string): WakeWordMatch {
  const normalized = text.trim();
  if (!normalized) return { matched: false };

  for (const pattern of WAKE_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      return {
        matched: true,
        wakePhrase: match[0],
      };
    }
  }

  return { matched: false };
}
