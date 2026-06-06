# Product Spec: Vesper

## 1. Product Thesis

**Vesper is a summonable AI expert for live calls.**

It listens silently, helps the human privately, and only speaks when invited by
name.

The wedge is sales engineering: an AE is on a technical sales call and needs
expert backup without breaking presence with the prospect.

## 2. Demo Promise

In a live demo, Vesper should prove three things:

1. It can answer technical product questions from a grounded knowledge base.
2. It can privately warn the rep when they say something wrong.
3. It can be naturally summoned into the call by name and speak out loud.

The product should feel like:

> "Your best sales engineer is in every call, but only talks when you ask."

**Answers are always generated ad hoc** from the live question + retrieved
knowledge, then spoken live via TTS. Nothing is canned or pre-scripted.

## 3. MVP Scope

### Build

- Web app with a live call workspace
- Knowledge base upload/admin screen (real ingestion + chunking)
- Realtime transcript view (ElevenLabs Scribe STT)
- Private rep copilot panel
- Embeddings + vector retrieval over uploaded knowledge
- Grounded ad-hoc answer generation with source citations
- Rep misstatement (contradiction) detection
- Wake-word voice handoff (summon by name)
- ElevenLabs TTS voice response (synthesized live from the generated answer)

### Do Not Build

- Zoom/Meet/Teams integration
- Auth / permissions
- CRM sync
- Analytics dashboard
- Calendar integration
- Multi-company admin
- Complex eval suite
- Production-grade document parsing (paste / .txt / .md only; PDF best-effort/P2)
- Speaker diarization (gating is by wake word, not by who speaks)

## 4. Primary User

**Sales rep / customer support rep**

They are live with a customer and need expert backup, but they do not want to
type, search docs, or lose connection with the customer.

## 5. Core Demo Flow

### Setup

Admin uploads or pastes product knowledge.

Example docs: Product overview, Security FAQ, Integrations FAQ, Implementation
FAQ, Pricing/packaging FAQ, Roadmap caveats.

### Live Call

1. Rep starts a call in Vesper.
2. Prospect asks: "Do you support SSO and SCIM?"
3. Vesper detects a technical question.
4. Private panel shows: detected question, suggested (ad-hoc generated) answer,
   source snippets, confidence status.
5. Rep says: "Vesper, can you take that one?"
6. Vesper answers aloud — the answer is generated live from the question +
   retrieved knowledge and synthesized via ElevenLabs TTS.
7. Rep later says something wrong, e.g. "SCIM is fully live today."
8. Vesper privately flags: "Careful: docs say SCIM is in private beta, not
   generally available," with a suggested correction.

## 6. Product Surfaces

### A. Knowledge Setup Page

Purpose: make Vesper feel like a reusable product, not a hardcoded demo.

Fields: company/product name; agent name (default "Vesper"); paste text or upload
.md/.txt; optional source title; process-knowledge button.

MVP behavior: store content, chunk into knowledge cards, embed them, show cards in
a table, allow sample preloaded knowledge for demo safety.

Acceptance criteria:
- User can add knowledge without code changes
- Knowledge cards display title, source, and text preview
- Retrieval can query these cards (embeddings)

### B. Live Call Workspace

Layout:
- Left: call transcript (speaker labels optional/cosmetic: Rep, Prospect, Vesper)
- Right: private Vesper panel
- Bottom: microphone controls + optional text input for demo fallback

Private Vesper panel cards: detected question, suggested answer, sources,
confidence, correction warning, "ready to answer if summoned."

Acceptance criteria:
- Transcript updates during live audio (or typed fallback)
- Technical questions create answer cards
- Rep misstatements create warning cards
- Vesper does not speak unless summoned

### C. Voice Handoff

Wake-phrase examples: "Vesper, can you take that one?" / "Vesper, what's our
answer?" / "Vesper, can you explain?" / "Let me bring in Vesper."

Behavior:
- Detect the wake word in the transcript (from anyone — speaker identity does not
  matter)
- Use the latest detected question / current topic
- Generate a grounded answer ad hoc (regenerate if context moved on since
  detection)
- Speak through ElevenLabs TTS; add Vesper's response to the transcript

Acceptance criteria:
- Vesper speaks only after the wake word
- Vesper's answer uses retrieved sources
- If no source is found, Vesper says it cannot confirm from the knowledge base

## 7. Architecture Overview

Frontend:
- Next.js single-page live call workspace + admin knowledge page

Backend (Next.js route handlers only):
- Knowledge ingestion + chunking + embedding
- Retrieval (vector search; keyword fallback)
- Ad-hoc answer generation
- Eval checks (grounding, confidence, contradiction)
- Scribe realtime token minting; ElevenLabs TTS

Storage:
- A datastore + vector store (e.g. SQLite + sqlite-vec, or Supabase/pgvector, or a
  local vector index). Prefer the simplest that supports real embeddings retrieval.

AI / Voice:
- LLM for question detection, answer generation, contradiction detection
- Embeddings for retrieval
- ElevenLabs **Scribe realtime STT** for the live transcript (`useScribe`,
  `scribe_v2_realtime` over WebSocket; client connects with a server-minted
  single-use token)
- ElevenLabs **TTS** (`textToSpeech.convert`) for voice output, streamed from a
  server route as `audio/mpeg`

## 8. Knowledge Model

### KnowledgeCard
```ts
type KnowledgeCard = {
  id: string;
  companyId: string;
  title: string;
  source: string;
  topicTags: string[];
  text: string;
  embedding?: number[];
  createdAt: string;
};
```

### DetectedQuestion
```ts
type DetectedQuestion = {
  id: string;
  callId: string;
  question: string;
  speaker: "prospect" | "rep" | "unknown";
  transcriptWindow: string;
  status: "new" | "answered" | "ignored";
  createdAt: string;
};
```

### AnswerCard
```ts
type AnswerCard = {
  id: string;
  callId: string;
  questionId: string;
  answer: string;
  sourceCardIds: string[];
  confidence: "high" | "medium" | "low";
  canSpeak: boolean;
  createdAt: string;
};
```

### CorrectionCard
```ts
type CorrectionCard = {
  id: string;
  callId: string;
  repStatement: string;
  issue: string;
  suggestedCorrection: string;
  sourceCardIds: string[];
  severity: "low" | "medium" | "high";
  createdAt: string;
};
```

## 9. Retrieval Contract

Input: current detected question, last 60–90s of transcript, company/product id.

Process:
1. Embed the query; vector-search knowledge cards.
2. Return top 3–5 cards (keyword search as fallback if embeddings unavailable).
3. Pass only those cards into answer generation.
4. Require the answer to cite source card ids.

Hackathon rule: reliable retrieval over fragile retrieval — but build it for real
(embeddings), do not prompt-stuff the entire KB.

## 10. Lightweight Eval Contract

### A. Grounding Check
Every answer must be based on retrieved cards. If no relevant card is retrieved,
Vesper refuses:
> "I do not have that confirmed in the product knowledge base. I would not want to guess."

### B. Confidence Check
Single source of truth: the **answer prompt's** `confidence`, informed by
retrieval score. High = source directly answers; Medium = partial; Low = not
clearly answered. Only high/medium answers may be spoken. (Ensure scripted
supported demo questions reliably score high so the summon never dies on stage.)

### C. Contradiction Check
Compare rep statements against product facts. Run against the full KB at demo
scale (not a narrow retrieved subset) so clear contradictions always surface.
Flag only clear contradictions.

Example — rep says "SCIM is fully live"; docs say "SCIM is in private beta" →
private warning: "Careful: SCIM is in private beta, not generally available."

## 11. Agent Behavior Rules

### Silent Mode (default)
Vesper listens, detects questions, retrieves + generates suggested answers, and
privately supports the rep. It never speaks.

### Summoned Mode (wake word only)
Vesper speaks to the room. Rules: answer the latest unresolved question; keep it
under ~30s; confident not salesy; do not cite internal sources aloud; do not
contradict the rep aloud; if uncertain, say it cannot confirm.

## 12. Core Prompts

### Question Detector
System: You are detecting customer questions during a live sales or support call.
Identify questions requiring product, technical, security, integration, pricing,
implementation, or compliance knowledge. Ignore small talk. Return JSON only.
```json
{ "hasQuestion": true, "question": "string",
  "category": "security | integration | implementation | pricing | product | compliance | other",
  "urgency": "low | medium | high" }
```

### Grounded Answer
System: You are Vesper, a company-specific expert assistant. Answer only using the
provided knowledge cards. If unsupported, say you cannot confirm from the knowledge
base. Keep it concise and useful for a live call.
Inputs: customer question, transcript context, knowledge cards.
```json
{ "answer": "string", "confidence": "high | medium | low",
  "sourceCardIds": ["string"], "canSpeak": true }
```

### Contradiction Detector
System: You are privately assisting a sales rep during a live call. Detect only
clear factual contradictions between what the rep said and the provided knowledge
cards. Do not nitpick wording or flag subjective claims.
```json
{ "hasContradiction": true, "repStatement": "string", "issue": "string",
  "suggestedCorrection": "string", "severity": "low | medium | high",
  "sourceCardIds": ["string"] }
```

### Spoken Answer
System: You are Vesper, a technical expert joining a live customer call. You were
invited by name. Answer naturally and briefly. Use only the approved answer. Do
not cite sources aloud. Do not say you are an AI unless asked.
Output: plain spoken response under 75 words.

## 13. API Contracts

### POST /api/knowledge
Creates + embeds knowledge cards from uploaded/pasted content.
Request: `{ "companyId", "title", "source", "text" }`
Response: `{ "cardsCreated": number, "cards": [] }`

### GET /api/knowledge
Returns knowledge cards.

### POST /api/call/transcript
Adds a transcript event and triggers analysis. Pipeline: detect → (only if
question) retrieve + generate answer; run contradiction on statements asserting a
product fact.
Request: `{ "callId", "speaker": "rep | prospect | unknown", "text" }`
Response: `{ "detectedQuestion": {}, "answerCard": {}, "correctionCard": {} }`

### POST /api/answer
Generates a grounded ad-hoc answer for a question.

### POST /api/summon
Generates the spoken answer ad hoc (or uses the just-generated, still-current one)
and returns synthesized audio. Streams `audio/mpeg` (no hosted `audioUrl`).
Request: `{ "callId", "wakePhrase" }`
Response: audio stream; metadata (spokenText, sourceCardIds) via headers or a
companion JSON field.

### POST /api/scribe/token
Mints a short-lived single-use Scribe realtime token for the browser. Never
returns the API key.

## 14. Modular Workstreams

Parallelizable across agents. Tracks 3 (retrieval+answering) and 5 (wake-word+TTS)
are highest-risk; prove the STT-in / TTS-out loop first.

1. **Frontend shell** — layout, navigation, transcript component, private panel,
   demo controls; mock data renders cleanly.
2. **Knowledge ingestion** — add-knowledge form, chunking, embedding, KnowledgeCard
   storage, card list; preloadable demo knowledge.
3. **Retrieval & answering** — vector retrieval, question detector, grounded
   ad-hoc answer generator, confidence logic, source display, refusal path.
4. **Live transcript** — Scribe realtime STT stream, optional speaker labels,
   typed/scripted-runner fallback for input; events trigger analysis.
5. **Voice (wake word + TTS)** — wake-word detection over transcript, TTS via
   `textToSpeech.convert`, audio playback, half-duplex gating, Vesper transcript entry.
6. **Backchannel corrections** — rep statement analyzer, contradiction detector,
   correction card UI (private, never spoken).
7. **Demo data & script** — AcmeFlow KB, 3–5 scripted questions, 1 scripted rep
   mistake, final demo script; full flow works with typed fallback in <3 min.

## 15. Recommended Demo Knowledge

Fictional B2B SaaS: **AcmeFlow** — AI workflow automation for enterprise ops teams.
- SSO via SAML 2.0 (GA)
- SCIM in private beta
- SOC 2 Type II complete
- HIPAA not supported
- Salesforce + HubSpot integrations live
- Workday integration on roadmap
- Implementation 2–4 weeks
- Data retention configurable up to 7 years
- On-prem deployment not supported
- EU data residency available on enterprise plan

## 16. Demo Script

**Scene 1 — Setup.** "First we load Vesper with company knowledge. This is what
makes it reusable across any company or expert role." Show uploaded docs + cards.

**Scene 2 — Live question.** Prospect: "Do you support SSO and SCIM? Our IT team
will ask." Private panel shows the answer. Rep: "Vesper, can you take that one?"
Vesper speaks (generated live): "Yes. AcmeFlow supports SSO through SAML 2.0
today. SCIM is currently in private beta, so for customers who need automated user
provisioning, we'd confirm beta eligibility during implementation."

**Scene 3 — Private correction.** Rep: "And just to confirm, SCIM is fully
generally available." Vesper private warning: "Careful: SCIM is private beta, not
generally available." Rep corrects aloud.

**Scene 4 — Unsupported question (private refusal, not spoken).** Prospect: "Can
you deploy fully on-prem?" Vesper's **private panel** shows: "Not confirmed as
supported — docs say AcmeFlow does not support on-prem deployment today." (Vesper
does not speak; it was not summoned.)

**Close.** "This starts as a sales engineer for live calls, but the platform is
broader: any company can load a knowledge base and create an expert that supports
humans in high-stakes conversations."

## 17. Build Priorities

**P0:** knowledge upload/paste + embedding; knowledge cards; transcript workspace;
question detection; grounded ad-hoc answer card; wake-word summon; ElevenLabs
spoken response; typed-input demo fallback.
**P1:** contradiction detection; confidence display; better source UI; scripted
demo runner.
**P2:** PDF ingestion; multi-agent roles; call recording; CRM follow-up summary;
real meeting integrations.

## 18. Definition of Done

1. A user can load product knowledge (ingested + embedded).
2. A live or typed transcript can ask technical questions.
3. Vesper produces a grounded private answer with citations (ad hoc).
4. Vesper speaks only when called by name, with a live-synthesized answer.
5. Vesper catches at least one rep misstatement privately.
6. The full demo runs in under 3 minutes.
7. It feels like a reusable expert platform, not a hardcoded chatbot.

## 19. Product Principle

Vesper should never feel like it is replacing the human. It should feel like it is
protecting the human, making them sharper, and letting them stay present in the
conversation.
