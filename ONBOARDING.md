# Vesper — Team Onboarding & Lane Hand-off

**Vesper is a summonable AI expert for live calls.** It listens via speech-to-text,
privately helps a sales rep, and speaks an *ad-hoc, knowledge-grounded* answer aloud
only when called by name. Wedge: technical sales calls.

We build **spec-first**: the `/spec` folder is the source of truth, code is derived
from it. Repo: https://github.com/LRHKyra/rebuild-hackathon

---

## 1. Set up (5 minutes)

```bash
git clone https://github.com/LRHKyra/rebuild-hackathon.git
cd rebuild-hackathon
npm install
cp .env.example .env.local      # fill in the values below
npm run dev                     # http://localhost:3000
```

Env vars (all server-side, never sent to the client):

| Variable              | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `ELEVENLABS_API_KEY`  | Scribe STT tokens + TTS                            |
| `ELEVENLABS_VOICE_ID` | The voice Vesper speaks with                       |
| `LLM_API_KEY`         | Question detection, answering, contradiction       |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally                    |

**Read these before coding (in order):** `spec/principles.md`, `spec/product.md`,
`spec/workstreams.md`, `spec/features/voice-loop.md`.

---

## 2. How we work (spec-driven development)

- **The spec is the source of truth.** `product.md` = what we build; `principles.md`
  = durable rules; `workstreams.md` = who owns what.
- **Change the spec before you change the code.** If reality forces a change, update
  the spec in the *same* commit.
- **Keep `main` green.** Commit small and often, referencing the spec section
  (e.g. `feat: product.md §6B answer card`). Branch + PR only for risky changes.
- **The API contracts (`product.md §13`) are frozen seams.** Code against them; each
  route returns mock data in the contract shape until the real backend lands, so we
  integrate from hour 0. Don't edit another lane's files.
- **No secrets client-side.** Keys are read at request time inside server routes.

---

## 3. The three lanes (one per person)

Full detail in [`spec/workstreams.md`](spec/workstreams.md). Assign owners:

| Lane | Owner | Scope |
| ---- | ----- | ----- |
| **A — Knowledge & AI core** ("brain") | ______ | ingestion, embeddings, retrieval, LLM evals; `/api/knowledge`, `/api/answer` |
| **B — Call pipeline & voice** ("ears & mouth") | ______ | `/api/call/transcript`, `/api/summon`, wake-word; extends the built voice core |
| **C — Workspace UI & demo** ("face") | ______ | call workspace, private panel cards, knowledge page, AcmeFlow data, demo script |

**Already built (don't rebuild):** the voice core — `GET /api/scribe/token`,
`POST /api/tts`, and `VoiceAgent` (live Scribe STT transcript + TTS playback +
half-duplex gating). Lane B extends it.

---

## 4. Launch prompts — paste into Claude Code from inside the cloned repo

Each teammate runs Claude Code in the repo and pastes **their** lane's prompt.

### Lane A — Knowledge & AI core

```text
You're in the Vesper hackathon repo; we use spec-driven development. Read these
first, in order: spec/principles.md, spec/product.md, spec/workstreams.md,
spec/features/voice-loop.md. The spec is the source of truth — change the spec
before the code, and keep main green.

I own Lane A — Knowledge & AI core. Scope: knowledge ingestion + chunking +
embeddings, vector retrieval, and the three LLM functions (question detection,
grounded answering, contradiction detection). I own ONLY these files:
src/lib/store.ts, src/lib/embeddings.ts, src/lib/retrieval.ts, src/lib/llm.ts,
src/app/api/knowledge/route.ts, src/app/api/answer/route.ts, and the data-model
types in src/types.ts. Do not touch other lanes' files.

Honor the data model in product.md §8 and the API contracts in §13 EXACTLY —
Lanes B and C code against them. Use the prompts in product.md §12. Rules: a
single confidence source (the answer prompt's confidence, informed by retrieval
score); detectContradiction must see the full knowledge base at demo scale;
unsupported questions must refuse per §10A; real embeddings retrieval, do NOT
stuff the whole KB into the prompt. Expose functions + routes only — no UI, no
transcript orchestration. Validate any ElevenLabs/LLM SDK usage against current
docs, not memory. Keys are server-side, validated at request time.

Do this in order: (1) land the §8 data-model types in src/types.ts; (2) stub
/api/knowledge and /api/answer to return mock data in the §13 contract shape so
the other lanes are unblocked; (3) implement ingestion + embeddings; (4) retrieval;
(5) the three LLM functions. Run npm run lint and npm run build before each commit;
commit small, referencing the spec section.
```

### Lane B — Call pipeline & voice

```text
You're in the Vesper hackathon repo; we use spec-driven development. Read these
first, in order: spec/principles.md, spec/product.md, spec/workstreams.md,
spec/features/voice-loop.md. The spec is the source of truth — change the spec
before the code, and keep main green.

I own Lane B — Call pipeline & voice. Scope: the transcript analysis pipeline,
the wake-word summon, and extending the EXISTING voice core (do not rebuild it:
GET /api/scribe/token, POST /api/tts, and src/components/VoiceAgent.tsx already
work — Scribe STT in, TTS out, half-duplex gating). I own ONLY these files:
src/app/api/call/transcript/route.ts, src/app/api/summon/route.ts,
src/lib/wakeword.ts, the voice-core files above, and a typed-transcript fallback
input. Do not touch other lanes' files.

Honor the API contracts in product.md §13 EXACTLY. /api/call/transcript
orchestrates per §13: detect -> (only if a question) retrieve + answer -> run
contradiction on statements that assert a product fact, by CALLING Lane A's lib
functions (stub them returning mock §8 shapes until Lane A lands them). Wake-word
gating is by name from ANYONE on the call (no speaker diarization — product.md
§6C). On summon, Vesper speaks an AD-HOC grounded answer (regenerate if the
conversation moved on since detection — never canned audio) and the route streams
audio/mpeg. Keep half-duplex gating (mute STT while TTS plays). Keys are
server-side, validated at request time.

Do this in order: (1) stub /api/call/transcript + /api/summon to return mock data
in the §13 shape so Lane C is unblocked; (2) wake-word matcher; (3) wire the live
Scribe transcript + a typed fallback into /api/call/transcript; (4) summon ->
ad-hoc answer (via Lane A) -> TTS stream; (5) contradiction triggering. Run npm
run lint and npm run build before each commit; commit small, referencing the spec.
```

### Lane C — Workspace UI & demo

```text
You're in the Vesper hackathon repo; we use spec-driven development. Read these
first, in order: spec/principles.md, spec/product.md, spec/workstreams.md,
spec/features/voice-loop.md. The spec is the source of truth — change the spec
before the code, and keep main green.

I own Lane C — Workspace UI & demo. Scope: the live call workspace UI, the private
Vesper panel cards, the knowledge setup page, the AcmeFlow demo data, and the demo
script/runner. I own ONLY these files: src/components/* (the workspace + panel +
knowledge-page UI), src/app/page.tsx and any workspace/admin routes,
src/lib/fixtures.ts, and demo-script files. Reuse the existing
src/components/VoiceAgent.tsx and src/components/Transcript.tsx. Do not touch
other lanes' files (no LLM/retrieval/voice internals).

Build against the API contracts in product.md §13 and render the private-panel
cards from product.md §6B: detected question, suggested answer, sources,
confidence, correction warning, and "ready to answer if summoned". Render against
MOCK data first (in the §13 shapes), then swap to live routes as Lanes A/B land
them. Scene 4 is a PRIVATE refusal, not spoken (product.md §16). The full demo
must run with the typed fallback in under 3 minutes (product.md §16, §18) with one
clear wow moment.

Do this in order: (1) call workspace layout + navigation rendering on mock data;
(2) the six private-panel cards; (3) the knowledge setup page (product.md §6A);
(4) AcmeFlow demo KB in src/lib/fixtures.ts (product.md §15); (5) the demo
script/runner (product.md §16). Run npm run lint and npm run build before each
commit; commit small, referencing the spec section.
```

---

## 5. Verify the voice loop (do this early — it's the core risk)

With real credentials in `.env.local`, `npm run dev`, open the app:
- **Speak** → your words appear in the transcript (Scribe STT).
- Type a line + **Speak** button → you hear it (ElevenLabs TTS).
- STT is muted while TTS plays (half-duplex). **Use a headset** so the mic doesn't
  re-capture Vesper's own voice.

If voice fails, the typed-transcript fallback still runs the whole demo.

---

## 6. Sequencing & rules of the road

1. **Hour 0:** Lane A lands `src/types.ts`; all routes return mock data → everyone unblocked.
2. **First integration:** Lane B's real `/api/call/transcript` replaces the mock Lane C renders; then Lane A's real retrieval replaces Lane B's stubs.
3. **Feature freeze at hour 9** — bug fixes only after. Lane C owns the rehearsed demo.
4. One owner per file/route. Cross-lane needs go through a contract, not an edit.
5. `src/types.ts` changes are announced by Lane A. Spec before code, always.
