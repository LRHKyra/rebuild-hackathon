# Feature: Voice Loop (Scribe STT in + TTS out)

**Traces to:** principles.md (core risk) + product.md §6C, §7, §13
**Status:** in-progress (replacing the original Conversational AI scaffold)

## Goal
Prove the two voice primitives Vesper actually needs, separately:
1. **STT in:** mic → ElevenLabs Scribe realtime → live transcript on screen.
2. **TTS out:** a server route converts a given string to speech and plays it in
   the browser.

This is idea-agnostic infrastructure; prove it before building the product on top.
It deliberately does NOT use ElevenLabs Conversational AI — Vesper's answers must
pass our own grounding/refusal pipeline, so we never hand control to an autonomous
agent.

## Behavior / acceptance criteria
- [ ] Start/Stop controls with a visible status
- [ ] Client mints a single-use Scribe token from `/api/scribe/token` and connects
      via the ElevenLabs Scribe realtime SDK (`useScribe`, `scribe_v2_realtime`)
- [ ] Partial + committed transcript text renders as it arrives
- [ ] A server route (`/api/tts` or `/api/summon`) calls `textToSpeech.convert`
      and streams `audio/mpeg`; the browser plays it via `<audio>`
- [ ] Half-duplex gating: STT is paused/muted while TTS is playing, resumed after
- [ ] No secret is ever sent to the client (only the short-lived Scribe token)
- [ ] A no-voice fallback renders if STT/TTS fails (typed transcript input still works)
- [ ] A human has heard synthesized speech AND seen their own speech transcribed
      (or this is one documented manual step away)

## Inputs / outputs
- In: mic audio; `ELEVENLABS_API_KEY` (server-side)
- Out: `{ token }` from `/api/scribe/token`; live transcript text in the UI; an
  `audio/mpeg` stream from the TTS route played in the browser

## Implementation notes
- Verified current ElevenLabs surface:
  - **STT:** `@elevenlabs/react` `useScribe` hook (realtime WebSocket,
    `scribe_v2_realtime`, ~150ms). Status: disconnected | connecting | connected |
    transcribing | error. Callbacks: `onPartialTranscript({text})`,
    `onCommittedTranscript({text})`. Methods: connect/disconnect/sendAudio/commit.
    No realtime diarization — speaker labels are out of scope.
  - **TTS:** `@elevenlabs/elevenlabs-js` `client.textToSpeech.convert(voiceId,
    { text })` returns a `ReadableStream` of audio bytes; stream it from a Next
    route as `audio/mpeg`.
  - **Token:** the browser needs a server-minted single-use token to open the
    Scribe WebSocket; mint it in `/api/scribe/token` (never ship the API key).
    Confirm the exact SDK token method against current docs before implementing.
- Retire the previous `useConversation` / signed-url-for-agent scaffold.
- Out of scope: anything tied to the specific product idea (knowledge, answers).
