# Feature: Voice Loop

**Traces to:** principles.md (core risk) + product.md §Core Flow
**Status:** in-progress

## Goal
Prove mic -> /api/elevenlabs/signed-url -> ElevenLabs -> transcript on screen.
This is idea-agnostic infrastructure; build it during kickoff.

## Behavior / acceptance criteria
- [ ] Start/Stop controls with a visible status
- [ ] Client fetches a signed URL from the route and connects via the ElevenLabs SDK
- [ ] Transcript messages render as they arrive
- [ ] No secret is ever sent to the client
- [ ] A no-voice fallback state renders if connection fails
- [ ] A human has heard the agent reply (or this is one documented manual step away)

## Inputs / outputs
- In: mic audio, ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID (server-side)
- Out: { signedUrl: string } from the route; transcript messages in the UI

## Implementation notes
- Use the official ElevenLabs SDK and check CURRENT ElevenLabs docs for the
  signed-URL endpoint and SDK usage — do not trust patterns from memory.
- Out of scope: anything tied to the specific product idea.
