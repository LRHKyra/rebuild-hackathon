# Workstreams — Team Hand-off (3 people)

**Traces to:** product.md §13 (API contracts) + §14 (workstreams).

The 7 workstreams in `product.md §14` are grouped into **3 lanes**, one per person.
Lanes are independent because they meet only at the **API contracts** below — those
are the frozen seams. Code against the contract; don't reach into another lane's
files.

> Already built and on `main` (idea-agnostic, don't rebuild): the voice core —
> `GET /api/scribe/token`, `POST /api/tts`, and `VoiceAgent` (live Scribe STT
> transcript + TTS playback + half-duplex gating). Lane B owns/extends it.

---

## The seams (frozen contracts — agree before coding, change only by team consensus)

These are the only things lanes share. Shapes live in `src/types.ts` (Lane A lands
them first, hour 0, so B and C can import).

- `KnowledgeCard`, `DetectedQuestion`, `AnswerCard`, `CorrectionCard` — product.md §8.
- `POST /api/knowledge` → `{ cardsCreated, cards }` ; `GET /api/knowledge` → cards
- `POST /api/answer { callId, question }` → `AnswerCard`
- `POST /api/call/transcript { callId, speaker, text }`
  → `{ detectedQuestion?, answerCard?, correctionCard? }`  ← **the big seam (B→C)**
- `POST /api/summon { callId, wakePhrase }` → streams `audio/mpeg` (+ spokenText)
- `GET /api/scribe/token` → `{ token }`  (built)

Rule: until a real backend lands, each route returns **mock data in the contract
shape**, so the other lanes integrate immediately.

---

## Lane A — Knowledge & AI core (the "brain")
Covers WS2 (ingestion) + WS3 (retrieval + answering) + the LLM eval functions.

**Owns (files):**
- `src/lib/store.ts` — in-memory + vector store (per product.md §7; real embeddings)
- `src/lib/embeddings.ts`, `src/lib/retrieval.ts` — embed + top-k vector search
- `src/lib/llm.ts` — `detectQuestion()`, `generateAnswer()`, `detectContradiction()`
  using the prompts in product.md §12
- `src/app/api/knowledge/route.ts`, `src/app/api/answer/route.ts`
- `src/types.ts` data model (lands first; coordinate edits)

**Deliverables / acceptance:**
- Paste/.txt/.md → chunked, embedded `KnowledgeCard`s; preloadable demo KB
- Retrieval returns top 3–5 cards; answers cite `sourceCardIds`; unsupported → refusal
- Single confidence source (the answer prompt's `confidence`, informed by retrieval)
- `detectContradiction()` sees the full KB at demo scale (not a narrow subset)

**Boundaries:** no UI, no transcript orchestration. Expose functions + routes only.
**Env:** `ANTHROPIC_API_KEY` (Claude) + `OPENAI_API_KEY` (embeddings), server-side,
request-time validation per principles.md.

---

## Lane B — Call pipeline & voice (the "ears & mouth")
Covers WS4 (live transcript wiring) + WS5 (wake-word summon) + WS6 orchestration.

**Owns (files):**
- `src/app/api/call/transcript/route.ts` — orchestrates per product.md §13:
  detect → (only if question) retrieve+answer → contradiction on fact-asserting
  statements, by **calling Lane A's lib functions** (stub them until A lands)
- `src/app/api/summon/route.ts` — wake-word → latest/ad-hoc answer → TTS stream
- `src/lib/wakeword.ts` — match "Vesper, …" in the transcript (anyone, no diarization)
- Voice core extensions (`VoiceAgent`, `/api/scribe/token`, `/api/tts` — built)
- Typed-transcript fallback input (feeds `/api/call/transcript`)

**Deliverables / acceptance:**
- Live or typed transcript events trigger analysis and return the contract shape
- Wake word → Vesper speaks an **ad-hoc** answer (regenerate if context moved on;
  never canned); audio streams back
- Half-duplex: STT muted while TTS plays (already wired in `VoiceAgent`)

**Boundaries:** don't implement retrieval/LLM (call Lane A); don't build panel UI.

---

## Lane C — Workspace UI & demo (the "face")
Covers WS1 (frontend shell) + the call workspace + WS7 (demo data & script).

**Owns (files):**
- `src/components/*` — call workspace (transcript view, mic controls) and the
  **private Vesper panel cards**: detected question, suggested answer, sources,
  confidence, correction warning, "ready to answer if summoned" (product.md §6B)
- Knowledge setup page UI (product.md §6A)
- `src/app/page.tsx` + any workspace/admin routes
- `src/lib/fixtures.ts` — AcmeFlow demo KB (product.md §15)
- Demo script + scripted-runner (product.md §16; WS7)

**Deliverables / acceptance:**
- Navigate setup ↔ call; renders cleanly on **mock data** first
- Panel cards render from `/api/call/transcript` responses; Scene 4 = private refusal
- Full demo runs with the typed fallback in < 3 minutes; one clear wow moment

**Boundaries:** consume API contracts only; no LLM/retrieval/voice internals.

---

## Sequencing & integration
1. **Hour 0:** Lane A lands `src/types.ts` data model. All three routes return
   mock-shaped data. → everyone unblocked immediately.
2. **Critical path (do early):** verify the live voice loop with **real credentials**
   (`.env.local`: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ANTHROPIC_API_KEY`,
   `OPENAI_API_KEY`) — this
   is the core risk and is already one manual step away.
3. **First integration:** Lane B's `/api/call/transcript` real response replaces the
   mock Lane C renders against. Then Lane A's real retrieval replaces Lane B's stubs.
4. **Demo lock:** feature freeze hour 9; Lane C owns the rehearsed demo path.

## Don't-collide rules
- One owner per file/route (above). Cross-lane needs go through a contract, not an edit.
- `src/types.ts` changes are announced (Lane A coordinates).
- Keep `main` green; commit small; branch + PR only for risky changes.
- Spec before code: if reality forces a contract change, update product.md §13 +
  this file in the same change, with team agreement.
