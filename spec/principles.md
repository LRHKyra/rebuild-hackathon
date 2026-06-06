# Architectural Principles

These are the durable constraints. Code must always obey them. The product spec
(`/spec/product.md` and `/spec/features/*`) is the source of truth; where these
principles ever conflict with the spec, the spec wins and this file is updated.

## Stack
- Next.js (App Router) + TypeScript + Tailwind. Deploy: Vercel.
- ElevenLabs official SDK for voice: **Scribe realtime STT** (in) and
  **text-to-speech `convert`** (out). NOT Conversational AI — Vesper's answers
  must be gated through our own grounding pipeline, so we never hand control to an
  autonomous agent.
- An LLM provider (server-side) for question detection, grounded answering, and
  contradiction detection. Embeddings + a vector store for retrieval.

## Boundaries
- No auth. No permissions. No third-party meeting integrations (Zoom/Meet/Teams),
  CRM sync, calendars, or analytics dashboards.
- One Next.js app: UI + API route handlers. No separate backend service.
- Build knowledge management for real (ingestion → chunking → embeddings →
  retrieval with citations). Do not shortcut it by stuffing all docs into a prompt.
- Favor explicit over clever; keep files small and focused.

## Answers are always ad hoc
- Vesper's spoken and suggested answers are generated live by the LLM from the
  actual question + retrieved knowledge. No canned audio, no pre-scripted answers.
- Generation may *start* when a question is detected (to populate the private
  panel and cut dead air), and is regenerated if the conversation has moved on.

## Secrets
- All keys are server-side only, never sent to the client: `ELEVENLABS_API_KEY`,
  `ELEVENLABS_VOICE_ID`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.
- The browser only ever receives short-lived, single-use tokens minted by our
  server routes (e.g. the Scribe realtime token) — never a raw key.
- Validate env at request time inside the route, not at import/build time, so
  builds and CI never need real secrets.

## Voice reliability
- When Vesper speaks (TTS), the mic re-captures its own audio. Use half-duplex
  gating: pause/stop STT while TTS plays, resume when playback ends. Demo with a
  headset. Enable browser `echoCancellation`.

## Risk & demo posture
- The voice loop is the core risk: prove Scribe STT (transcript on screen) +
  on-demand TTS (a string spoken in the browser) before building anything fancy.
- Live STT is the primary path; a typed/scripted transcript runner is the demo
  safety fallback for the *input* side only — Vesper's reasoning and answers stay
  live regardless.
- Demo reliability beats feature completeness.
- Feature freeze at hour 9 — bug fixes only after.
- One repo, one production deploy. Keep main green and deployable.

## Decisions (append as they're made, with a one-line why)
- (seed) SDD: spec is source of truth; code traces to spec. — keeps 3 people aligned without meetings.
- Spec supersedes principles: overwrite this file when it conflicts with the spec. — the spec is what we actually agreed to build.
- Voice loop = Scribe STT + on-demand TTS, not Conversational AI. — answers must pass our grounding/refusal pipeline; an autonomous agent can't be gated.
- Real knowledge management (embeddings + vector retrieval + citations), not prompt-stuffing. — retrieval quality is the product's credibility.
- Added LLM dependency: Claude via `ANTHROPIC_API_KEY` (Haiku 4.5 for detection/contradiction, Sonnet 4.6 for answering) + OpenAI `OPENAI_API_KEY` for embeddings. — detection/answering/contradiction need an LLM; Anthropic ships no embeddings.
- Retrieval: in-memory cosine over OpenAI embeddings, seeded from committed fixtures, behind a swappable `KnowledgeStore` interface. — simplest real RAG at demo scale; SQLite won't persist on Vercel; Supabase/pgvector is the drop-in if shared persistent uploads are needed.
