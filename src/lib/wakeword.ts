// Traces to: spec/product.md §6C (Voice Handoff) + workstreams.md Lane B.
//
// Wake-word matching is intentionally simple: no speaker identity, no meeting
// integration, just transcript text containing a natural way to bring in Vesper.

export type WakeWordMatch = {
  matched: boolean;
  wakePhrase?: string;
};

const WAKE_PATTERN = /\bvesper\b/i;

export function detectWakeWord(text: string): WakeWordMatch {
  const normalized = text.trim();
  if (!normalized) return { matched: false };

  const match = normalized.match(WAKE_PATTERN);
  if (match) {
    return { matched: true, wakePhrase: match[0] };
  }

  return { matched: false };
}
