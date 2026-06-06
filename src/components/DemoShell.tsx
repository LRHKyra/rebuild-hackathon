// Traces to: spec/product.md §Core Flow — the on-screen demo scaffold.
//
// This is the single screen the demo runs on. The voice loop (VoiceAgent) is
// real and idea-agnostic (Scribe STT in + TTS out). The product surfaces —
// knowledge setup, private answer/correction cards — are not built yet; ResultCard
// and the copy here are PLACEHOLDERs. See product.md §6 and the TODO(spec) markers.

import { VoiceAgent } from "@/components/VoiceAgent";
import { TypedTranscriptFallback } from "@/components/TypedTranscriptFallback";

export function DemoShell() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Vesper</h1>
        {/* TODO(spec): product.md §1 / §6B — replace with the live call workspace. */}
        <p className="text-sm text-gray-600 dark:text-gray-300">
          A summonable AI expert for live calls. The voice core below is real
          (Scribe STT + TTS); the call workspace and knowledge surfaces are next —
          see <code>/spec/product.md</code>.
        </p>
      </header>

      {/* Real, idea-agnostic infrastructure — see spec/features/voice-loop.md. */}
      <VoiceAgent />

      {/* Demo safety path — typed transcript drives Lane B's call pipeline. */}
      <TypedTranscriptFallback />
    </main>
  );
}
