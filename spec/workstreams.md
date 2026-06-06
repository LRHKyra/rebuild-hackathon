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

> **Reconciliation note (Lane A shipped; code = source of truth).** Lane A built
> past the "stub" stage. As built: `ANTHROPIC_API_KEY` (Claude — Haiku detect/contra,
> Sonnet answer) + `OPENAI_API_KEY` (embeddings); in-memory cosine store. Lane A also
> landed **working reference impls of `/api/call/transcript` + `src/lib/wakeword.ts`**
> (Lane B's territory) — Lane B extends, not builds from scratch. Two contract deltas
> vs the original: the transcript response gained `isWake`/`summon`, and `/api/summon`
> is not yet a separate route. Full detail in product.md §13 / §10C.

## The seams (frozen contracts — agree before coding, change only by team consensus)

These are the only things lanes share. Shapes live in `src/types.ts` (Lane A lands
them first, hour 0, so B and C can import).

- `KnowledgeCard`, `DetectedQuestion` (+`category?`), `AnswerCard`, `CorrectionCard`,
  `RetrievedCard`, `TranscriptAnalysis` — product.md §8.
- `POST /api/knowledge` → `{ cardsCreated, cards }` (cards omit `embedding`; JSON paste
  **or** multipart .txt/.md/.pdf upload) ; `GET /api/knowledge?companyId=` → `{ cards }`
- `POST /api/answer { question, callId?, companyId?, questionId? }` → `AnswerCard`
- `POST /api/call/transcript { callId, speaker, text, companyId? }`
  → `{ detectedQuestion?, answerCard?, correctionCard?, isWake?, summon? }`
  ← **the big seam (B→C)**; shipped as a reference impl, not a stub
- `POST /api/summon` → **not built yet** (Lane B owns); the speakable answer currently
  returns as `summon` on the transcript response. `POST /api/tts { text }` → `audio/mpeg`
  is the built TTS primitive Lane B's summon will use.
- `GET /api/scribe/token` → `{ token }`  (built)

Rule: any route NOT yet implemented returns **mock data in the contract shape** so the
other lanes integrate immediately. (Lane A's routes above are now real, not mock.)

---

## Lane A — Knowledge & AI core (the "brain")
Covers WS2 (ingestion) + WS3 (retrieval + answering) + the LLM eval functions.

**Owns (files) — as built:**
- `src/lib/store.ts` — in-memory cosine vector store behind a `KnowledgeStore` interface
- `src/lib/embeddings.ts` (OpenAI, batched), `src/lib/retrieval.ts` — embed + top-k search
- `src/lib/chunk.ts` (paragraph-packed chunking), `src/lib/pdf.ts` (`unpdf` text extract)
- `src/lib/llm/` — `client.ts` (shared Claude client + forced-tool helper) + one file
  each for `detectQuestion()` / `generateAnswer()` / `detectContradiction()` + `index.ts`,
  using the prompts in product.md §12. (Note: this is a **directory**, not the originally
  planned single `src/lib/llm.ts`.)
- `src/app/api/knowledge/route.ts`, `src/app/api/answer/route.ts`
- `scripts/check-keys.mjs` (real key ping) + `scripts/call-sim.mjs` (end-to-end driver)
- `src/types.ts` data model (lands first; coordinate edits)

**Deliverables / acceptance (as built):**
- Paste/.txt/.md/.pdf → chunked, embedded `KnowledgeCard`s
- Retrieval returns top-K cards (default 5); answers cite `sourceCardIds`; unsupported → refusal
- Single confidence source (the answer prompt's `confidence`, informed by retrieval)
- `detectContradiction()` is scope-agnostic; the transcript route runs it against the
  **top-8 retrieved cards**, not the full KB (changed from spec — see product.md §10C)
- ⚠️ **No demo-KB preload/seed shipped.** The in-memory store starts empty and is not
  persistent; knowledge must be (re)ingested after each restart/deploy. Auto-seeding
  from `src/lib/fixtures.ts` (Lane C) is unowned — Lane B/C should wire it for demo safety.

**Boundaries:** no UI. **Deviation (deliberate):** Lane A also landed reference impls of
`/api/call/transcript` + `src/lib/wakeword.ts` (Lane B's files) so the loop was provable
end-to-end via `call-sim`. Lane B now owns/extends those — coordinate before editing.
**Env:** `ANTHROPIC_API_KEY` (Claude) + `OPENAI_API_KEY` (embeddings), server-side,
request-time validation per principles.md.

---

## Lane B — Call pipeline & voice (the "ears & mouth")
Covers WS4 (live transcript wiring) + WS5 (wake-word summon) + WS6 orchestration.

**Owns (files) — note what Lane A pre-landed:**
- `src/app/api/call/transcript/route.ts` — **already exists as a working reference
  impl** (Lane A) that calls Lane A's real lib functions (no stubbing needed). Extend
  it: wire the live Scribe transcript, add a rolling 60–90s window (it currently passes
  only the latest line), tune the wake/question/statement branching.
- `src/lib/wakeword.ts` — **already exists** (matches "Vesper" anywhere, case-insensitive,
  no diarization). Extend if you want stricter wake-phrase matching.
- `src/app/api/summon/route.ts` — **NOT built yet; this is your main new route.** The
  transcript route returns the speakable `AnswerCard` as `summon`; build the audio path:
  regenerate ad hoc if context moved on, then stream TTS via the built `POST /api/tts`.
- Voice core extensions (`VoiceAgent`, `/api/scribe/token`, `/api/tts` — built)
- Typed-transcript fallback input (feeds `/api/call/transcript`; `scripts/call-sim.mjs`
  is a working CLI driver you can model the UI fallback on)

**Deliverables / acceptance:**
- Live or typed transcript events trigger analysis and return the contract shape
- Wake word → Vesper speaks an **ad-hoc** answer (regenerate if context moved on;
  never canned); audio streams back
- Half-duplex: STT muted while TTS plays (already wired in `VoiceAgent`)

**Boundaries:** don't implement retrieval/LLM (call Lane A); don't build panel UI.
Coordinate with Lane A before editing the transcript route / wakeword they pre-landed.

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
1. ~~**Hour 0:** Lane A lands `src/types.ts` + mock routes.~~ **Done** — Lane A shipped
   real `/api/knowledge`, `/api/answer`, `/api/call/transcript` (reference impl), the
   LLM lib, embeddings, store, and `wakeword.ts`. Everyone is unblocked against live routes.
2. **Critical path (do early):** verify the live voice loop with **real credentials**
   (`.env.local`: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ANTHROPIC_API_KEY`,
   `OPENAI_API_KEY`). `npm run check-keys` pings Claude + OpenAI; `npm run call-sim`
   drives ingest → transcript end-to-end. This is the core risk.
3. **First integration:** Lane C renders the **real** `/api/call/transcript` response
   (incl. `isWake`/`summon`). Lane B extends that reference impl (live Scribe, rolling
   window) and builds the `/api/summon` audio route on top of the `summon` field.
4. **Demo lock:** feature freeze hour 9; Lane C owns the rehearsed demo path. Wire
   demo-KB auto-seed (store is non-persistent) so the call workspace is never empty.

## Don't-collide rules
- One owner per file/route (above). Cross-lane needs go through a contract, not an edit.
- `src/types.ts` changes are announced (Lane A coordinates).
- Keep `main` green; commit small; branch + PR only for risky changes.
- Spec before code: if reality forces a contract change, update product.md §13 +
  this file in the same change, with team agreement.
