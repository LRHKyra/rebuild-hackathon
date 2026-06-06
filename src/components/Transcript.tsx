// Traces to: spec/features/voice-loop.md — render committed + partial transcript.
//
// Pure presentational component: given committed lines and the live partial line,
// render them. No SDK knowledge here.

import type { TranscriptLine } from "@/types";

type TranscriptProps = {
  lines: TranscriptLine[];
  partial: string;
};

export function Transcript({ lines, partial }: TranscriptProps) {
  if (lines.length === 0 && !partial) {
    return (
      <p className="text-sm text-gray-500 italic">
        Transcript will appear here as you speak.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5 text-sm" aria-live="polite">
      {lines.map((line) => (
        <li key={line.id} className="text-gray-900 dark:text-gray-100">
          {line.text}
        </li>
      ))}
      {partial && (
        <li className="text-gray-500 italic dark:text-gray-400">{partial}</li>
      )}
    </ul>
  );
}
