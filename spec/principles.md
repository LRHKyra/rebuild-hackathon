# Architectural Principles

These are the durable constraints. Code must always obey them. Changing this
file is a deliberate, team-agreed act.

## Stack
- Next.js (App Router) + TypeScript + Tailwind. Deploy: Vercel.
- Official ElevenLabs SDK is preferred. No other non-essential dependencies.

## Boundaries
- No auth. No database. Persistence is static fixtures.
- No state-management library, no second app, no backend outside Next.js.
- No broad abstractions for future scale. Favor explicit over clever; keep files small.

## Secrets
- API key and agent ID are server-side only, never sent to the client.
- The client gets a signed URL from /api/elevenlabs/signed-url; it never holds a secret.
- Validate env at request time inside the route, not at import/build time, so
  builds and CI never need real secrets.

## Risk & demo posture
- The live voice loop is the core risk: prove it before building anything fancy.
- Demo reliability beats feature completeness.
- Feature freeze at hour 9 — bug fixes only after.
- One repo, one production deploy. Keep main green and deployable.

## Decisions (append as they're made, with a one-line why)
- (seed) SDD: spec is source of truth; code traces to spec. — keeps 3 people aligned without meetings.
