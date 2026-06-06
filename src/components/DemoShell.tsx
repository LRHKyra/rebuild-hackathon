// Traces to: spec/product.md §Core Flow — the on-screen demo scaffold.
//
// This is the single screen the demo runs on. The voice loop (VoiceAgent) is
// real and idea-agnostic. Everything tied to the specific product idea — the
// title, the description, and what ResultCard shows — is a PLACEHOLDER until
// /spec/product.md is filled in. See the TODO(spec) markers below.

import { VoiceAgent } from "@/components/VoiceAgent";
import { ResultCard } from "@/components/ResultCard";
import { PLACEHOLDER_RESULT } from "@/lib/fixtures";

export function DemoShell() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        {/* TODO(spec): product.md §One-liner — replace the title. */}
        <h1 className="text-2xl font-bold">Voice Demo</h1>
        {/* TODO(spec): product.md §Demo user / §Core flow — replace this copy. */}
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Placeholder shell. The voice loop below is real and idea-agnostic.
          Fill in <code>/spec/product.md</code>, then build the core flow here.
        </p>
      </header>

      {/* Real, idea-agnostic infrastructure — see spec/features/voice-loop.md. */}
      <VoiceAgent />

      {/* TODO(spec): product.md §Core Flow / §Wow moment — drive this from real
          state produced by the flow instead of static fixtures. */}
      <ResultCard result={PLACEHOLDER_RESULT} />
    </main>
  );
}
