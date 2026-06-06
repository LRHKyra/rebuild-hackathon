# Voice Hackathon — Spec-Driven Development

A Next.js + ElevenLabs voice-loop app, built **spec-first**. The spec in
[`/spec`](./spec) is the source of truth; code in [`/src`](./src) is derived
from it. Read this before writing code.

---

## The spec-driven workflow (read this first)

We have **three layers**, separated on purpose because they change at different
speeds and have different owners:

1. **Architectural principles** — [`spec/principles.md`](./spec/principles.md).
   The durable rules code must always obey (stack, secrets, no auth/db,
   voice-loop-first). Changes slowest. **Changing it needs team agreement** —
   flag it, don't do it silently.
2. **Product spec** — [`spec/product.md`](./spec/product.md) and
   [`spec/features/*`](./spec/features). What we're building and why: demo flow,
   wow moment, acceptance. Owned by the team; changes as we learn.
3. **Working code** — [`/src`](./src). The how. Changes fastest. Always derived
   from the spec, never violates the principles.

### The one rule that makes this work

**Change the spec before you change the code.** Every code change traces to a
spec section. If reality forces a code decision the spec didn't anticipate,
update the spec in the *same* change.

### The iteration loop (every change)

1. Update the relevant spec file first (`product.md` or a feature spec).
2. Update `/src` to match.
3. Verify against the spec's **Definition of Done**.
4. Commit referencing the spec section, e.g.
   `feat: implement product.md §Core Flow step 2`.

> **First task for the team:** fill in [`spec/product.md`](./spec/product.md)
> within the first 30 minutes. The first-pass app is generated from it.

---

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable               | Where it lives        | Purpose                                      |
| ---------------------- | --------------------- | -------------------------------------------- |
| `ELEVENLABS_API_KEY`   | **server only**       | Mints signed URLs. Never sent to the client. |
| `ELEVENLABS_AGENT_ID`  | **server only**       | The Conversational AI agent to connect to.   |
| `NEXT_PUBLIC_APP_URL`  | client + server       | App base URL (`http://localhost:3000` local).|

Secrets are read **at request time** inside the route, so `npm run build` and CI
never need real credentials.

---

## Verify the voice loop (manual step)

The live voice loop is our core risk — prove it early.

1. Create an ElevenLabs Conversational AI agent; copy its **Agent ID** and an
   **API key**.
2. Put both in `.env.local` (`ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`).
3. `npm run dev`, open the app, click **Start**, allow the mic, and **speak**.
4. ✅ Success = you hear the agent reply and the transcript fills in.
5. If connection fails, the UI drops into the **no-voice fallback** state — the
   rest of the demo still works.

---

## Deploy on Vercel (human handoff)

The repo is committed locally only. To ship:

1. Push to GitHub (create the remote yourself; the kickoff did not).
2. In Vercel: **Import** the GitHub repo (framework auto-detects as Next.js).
3. Add the three env vars under **Settings → Environment Variables** for both
   **Production** and **Preview**.
4. Push to `main` → Production deploy. Open a PR → Preview deploy.

CI ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) runs lint + build
on every push and PR using dummy env values.

---

## Repo rules

- **Keep `main` green** and deployable. One repo, one production deploy.
- **Commit small and often**; reference the spec section in the message.
- **Branch + PR only for risky changes**; otherwise commit to `main`.
- **No secrets in git.** `.env.local` is ignored; `.env.example` is committed.
- **Feature freeze at hour 9** — bug fixes only after.
- **Principles changes need team agreement** — flag, don't do silently.

---

## What's built right now

- ✅ Voice loop ([`spec/features/voice-loop.md`](./spec/features/voice-loop.md)):
  mic → `/api/elevenlabs/signed-url` → ElevenLabs → transcript, with a no-voice
  fallback. Real and idea-agnostic.
- ⏳ Product flow: placeholder. Everything tied to the product idea is marked
  `// TODO(spec): see /spec/product.md`. Fill in `product.md`, then build it.
