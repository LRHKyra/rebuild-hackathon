// Traces to: spec/features/voice-loop.md — "Transcript messages render as they arrive."
//
// Pure presentational component: given typed transcript messages, render them.
// No SDK knowledge here, which keeps it easy to reason about and test.

import type { TranscriptMessage } from "@/types";

type TranscriptProps = {
  messages: TranscriptMessage[];
};

export function Transcript({ messages }: TranscriptProps) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">
        Transcript will appear here as you speak with the agent.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-live="polite">
      {messages.map((message) => (
        <li
          key={message.id}
          className={
            message.role === "agent"
              ? "self-start max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              : "self-end max-w-[85%] rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
          }
        >
          <span className="block text-[10px] uppercase tracking-wide opacity-60">
            {message.role}
          </span>
          {message.text}
        </li>
      ))}
    </ul>
  );
}
