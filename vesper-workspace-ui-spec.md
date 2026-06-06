# Vesper — Workspace UI Spec (advisor screen)

**Audience:** the engineer/agent building this UI.
**Read this whole file before writing code.** Where a line is marked *Rationale (do not change)*, the decision is deliberate — implement it as written, do not "improve" it.

---

## 1. What this is

Vesper is a silent on-screen assistant that helps a salesperson during a live **audio** sales call with an external customer. This spec covers **only the salesperson's advisor screen** ("the workspace").

The salesperson reads this screen while talking on the phone. They have roughly **one-second glances** to spare. Every rule below exists to protect those glances. The aesthetic is **minimal**: whitespace, few words, quiet colors, no chrome.

There is **no video** on this call. The whole display belongs to this UI.

The screen has **four labeled regions**, but only some are functional in this build:

| Region | Status in this build |
|---|---|
| **Corrections** | Functional — the core feature |
| **Source drawer** | Functional — opens under Corrections on demand |
| **Personal notes** | Functional |
| **Chat w/ Vesper** | **Placeholder only — no functionality** |
| **Next topics** | **Placeholder only — no functionality** |

> Chat and Next topics are not supported yet. Build them as **inert, labeled boxes** that reserve their space in the layout. No data, no input, no behavior. They exist so the layout is correct for when they're built later.

---

## 2. Scope

### In scope (build this)
- The **two-state layout** in §3 (default, and source-expanded).
- **Corrections** — a bottom-populating, never-erasing feed.
- **Source drawer** — expands below Corrections when a correction's source is tapped; collapses to dismiss.
- **Personal notes** — jot + list.
- **Chat w/ Vesper** and **Next topics** — visual placeholders only.
- A mock-data driver that animates the demo (§9).

### Out of scope (do NOT build)
- **Chat functionality** — the box is a placeholder. No messaging, no answers, no input handling.
- **Next topics functionality** — the box is a placeholder. No feed, no suggestions.
- **Speaking state** — what the screen does when Vesper talks out loud. Another team owns this.
- **Transcript panel** — does not exist.
- **Settings / preferences panel** — none.
- Any real audio, transcription, or AI/LLM backend. The UI runs on mock data only.

---

## 3. Layout — two states

Two columns. **Left ~58%, right ~42%** (right column min 320px so it doesn't collapse). Column gap `8px`; vertical gaps between stacked panels `8px`; outer padding `12–16px`.

### Right column (same in both states)
Top to bottom:
- **Personal notes** — large, ~72% of the column height.
- **Chat w/ Vesper** — thin placeholder bar, ~14%.
- **Next topics** — thin placeholder bar, ~14%.

### Left column — STATE A: default (no source open)
- **Corrections** fills the entire left column height.

```
+---------------------------------+--------------------------+
|                                 |  PERSONAL NOTES          |
|                                 |  (jot + list)            |
|   CORRECTIONS                   |                          |
|   (feed, full height)           |                          |
|                                 +--------------------------+
|                                 |  Chat w/ Vesper  [placeholder]
|                                 +--------------------------+
|                                 |  Next topics     [placeholder]
+---------------------------------+--------------------------+
              ~58%                            ~42%
```

### Left column — STATE B: source expanded (user tapped a correction's source)
- **Corrections** shrinks to the **top ~50%** of the left column.
- **Source drawer** occupies the **bottom ~50%**, directly below Corrections.

```
+---------------------------------+--------------------------+
|   CORRECTIONS                   |  PERSONAL NOTES          |
|   (feed, ~top half)             |  (jot + list)            |
|                                 |                          |
+---------------------------------+                          |
|   SOURCE DRAWER                 +--------------------------+
|   (source document for the      |  Chat w/ Vesper  [placeholder]
|    tapped correction)           +--------------------------+
|   ~bottom half                  |  Next topics     [placeholder]
+---------------------------------+--------------------------+
```

The transition between A and B is a smooth expand/collapse (~`350ms`), not a pop. *Rationale (do not change): putting the source in the same column as the correction means the eye barely moves to read it.*

---

## 4. Corrections feed (left column)

A **log** of facts the salesperson got wrong. Important, but expect **few** per call.

- **Items populate at the BOTTOM.** The newest correction appears at the bottom; older ones sit above. *Rationale (do not change): the bottom is where the eye rests during a call. This is the most counterintuitive decision in the spec — do NOT reverse it to newest-at-top.*
- A new correction **fades in** at the bottom (`250ms`). No pop, no flash.
- **Never erases.** Corrections accumulate for the whole call. When the panel fills, the oldest scroll/clip off the top (still in state; scrolling to review is allowed but not required).
- The **most recent** correction is highlighted (amber: tinted background + border). **Older** ones stay visible but greyed (opacity ~0.55). Never removed.
- A correction card contains:
  - The **correct fact**, plainly stated and self-contained (e.g., "p99 latency is 75ms, not 50ms"). Must read correctly with nothing else on screen. *Rationale (do not change): there is no transcript to provide context.*
  - Optionally the **misstatement** struck through (e.g., ~~50ms~~).
  - A **source chip** (e.g., "API docs v2.3 ›") when the correction has a source. **Tapping the chip opens the Source drawer (§5)** with that correction's source.

---

## 5. Source drawer (left column, below Corrections)

The place to dig deeper into the document behind a correction.

- **Default: collapsed/hidden** (State A). Corrections has the full left column.
- **On tapping a source chip** in a correction: the drawer expands to the bottom ~50% of the left column (State B); Corrections shrinks to the top ~50%.
- The drawer shows, for the tapped correction's source:
  - The source **title/label** (e.g., "API docs v2.3 · Performance").
  - The relevant **excerpt** from the source document.
  - The cited **phrase highlighted** within the excerpt.
  - It may be scrollable to show surrounding document context, but the highlighted phrase is what matters.
- The drawer has a **close control**; closing collapses it and returns Corrections to full height (back to State A).
- Only **one** source is shown at a time (the most recently tapped). Tapping a different correction's chip swaps the drawer's content (drawer stays open).
- This is an **in-column expand/collapse**, NOT a slide-over overlay and NOT a full-page view. Do not build either of those.

---

## 6. Personal notes (right column, top — large)

A space to quickly jot personal notes without leaving the app.

- A bottom-anchored list of short note fragments (newest at the bottom) plus a one-line input pinned at the bottom.
- Optimized for **two-word fragments** ("competitor: Datadog", "follow up: pricing"), not paragraphs.
- Notes save to state (they'd feed a post-call summary, which is out of scope — just retain them).

---

## 7. Placeholders (right column, bottom two bars)

**Chat w/ Vesper** and **Next topics** are **inert**:
- Render each as a thin labeled box matching the panel styling (border, radius, header label).
- Optionally a faint muted hint like "coming soon" inside.
- **No input, no data, no interaction, no behavior.** They only reserve layout space.

---

## 8. Global interaction & motion rules

- **Zero clicks required during a call.** The only interactions are optional: tapping a source chip (opens drawer), closing the drawer, typing a note.
- **Grey-then-fade, never abrupt disappearance.** Older corrections grey out and stay; they leave only by scrolling off the top. Nothing pops out of existence. *Rationale (do not change): sudden disappearance is motion, and motion yanks the eye at the wrong moment.*
- **All motion is soft.** Fade-in `250ms`; drawer expand/collapse `350ms ease`. No pop, flash, bounce, or overshoot.
- **Glanceability.** Any card is readable in ~1 second: few words, generous size, high contrast.
- **Minimal aesthetic.** Quiet palette, thin borders, generous whitespace, two font weights only (400 + 500), sentence case everywhere.
- **(Optional, secondary)** Corrections and Personal notes may carry a minimize control in their headers to collapse to a header bar. Lower priority than everything above; skip if short on time. Placeholders don't need it.
- **Governing principle:** every layer earns its disruption. Prefer the calmest treatment that does the job.

---

## 9. Data model

The UI renders from this state, driven by the mock driver in §10. (TypeScript for clarity; use any language/framework.)

```ts
type Source = {
  label: string;            // e.g. "API docs v2.3 · Performance"
  documentExcerpt: string;  // text shown in the Source drawer
  highlightPhrase?: string; // substring of documentExcerpt to highlight
};

type Correction = {
  id: string;
  timestamp: number;        // ms epoch; ordering (newest = bottom)
  statement: string;        // the correct fact, self-contained
  misstatement?: string;    // optional, struck-through
  source?: Source;          // tapping its chip opens the Source drawer
};

type Note = { id: string; timestamp: number; text: string };

type WorkspaceState = {
  corrections: Correction[];
  notes: Note[];
  sourceDrawer: {
    open: boolean;
    source: Source | null;  // what the drawer shows; null when closed
  };
  // Chat w/ Vesper and Next topics are placeholders — no state needed.
};
```

Rendering rules:
- Corrections: sort by timestamp asc (newest at bottom). Max-timestamp one = amber/highlighted; others greyed. Never removed.
- Layout state: `sourceDrawer.open === false` → State A (Corrections full height). `true` → State B (Corrections top ~50%, drawer bottom ~50%).
- Notes: sort asc, newest at bottom; input row beneath.

---

## 10. Mock demo driver

Hardcode a timed sequence so the demo shows every behavior in ~45–75s with no backend. Dispatch these events on a timer to mutate `WorkspaceState`. Keep timings editable at the top of the file.

```js
// t in seconds. Each event mutates state.
const demoScript = [
  { t: 1,  add: "correction",
           statement: "p99 latency is 75ms, not 50ms",
           misstatement: "50ms",
           source: { label: "API docs v2.3 · Performance",
                     documentExcerpt: "Sustained throughput maintains a p99 of 75ms under standard load; p50 sits at 28ms. Burst traffic above 10k rps may add 15-20ms.",
                     highlightPhrase: "p99 of 75ms" } },
  { t: 4,  add: "note", text: "competitor: Datadog" },
  { t: 7,  add: "correction",
           statement: "Pro tier = 50 seats, not unlimited",
           misstatement: "unlimited",
           source: { label: "Pricing & packaging",
                     documentExcerpt: "Pro includes up to 50 seats; add-ons at $4/seat up to 100, then Enterprise.",
                     highlightPhrase: "up to 50 seats" } },
  { t: 10, openSource: "API docs v2.3 · Performance" },   // simulate tapping the first correction's source chip -> State B
  { t: 16, add: "note", text: "follow up: pricing tier" },
  { t: 19, closeSource: true },                            // drawer collapses -> State A
  { t: 22, add: "correction",
           statement: "Webhooks retry 8x over 24h, not 3x",
           misstatement: "3x",
           source: { label: "API docs v2.3 · Webhooks",
                     documentExcerpt: "Failed deliveries retry with exponential backoff, up to 8 attempts across 24 hours, then move to a dead-letter queue.",
                     highlightPhrase: "up to 8 attempts" } },
  { t: 26, openSource: "API docs v2.3 · Webhooks" },       // open the newest correction's source
];
```

The driver should stop gracefully (or loop) at the end.

---

## 11. Visual tokens (starting values)

Defaults; map to an existing design system if one exists. Light mode required; dark mode nice-to-have.

```css
--text-primary:   #1c1c1a;
--text-secondary: #5f5e5a;
--text-muted:     #8a897f;

--bg-page:        #f4f3ee;   /* outer */
--bg-panel:       #ffffff;   /* panels */
--border:         rgba(0,0,0,0.12);

--amber-bg:       #faeeda;   /* newest correction */
--amber-border:   #ba7517;
--amber-text:     #854f0b;

--info-bg:        #e6f1fb;   /* highlighted phrase, links */
--info-text:      #185fa5;
--info-border:    #378add;

--faded-opacity:  0.55;      /* older corrections */

--card-body:      13-15px;
--label:          10-11px;   /* panel headers */
--placeholder:    var(--text-muted);

--radius:         8px;
--fade-in:        250ms;
--drawer-move:    350ms;
```

Two font weights only (400, 500). Sentence case everywhere. No gradients, no drop shadows.

---

## 12. Acceptance criteria (test each)

- [ ] Two columns: left ~58% (Corrections + room for the drawer), right ~42% (Personal notes large, then the two placeholder bars).
- [ ] **State A (default):** Corrections fills the full left column; the Source drawer is not visible.
- [ ] A new correction appears at the **bottom** with a soft fade-in; older ones sit above.
- [ ] The newest correction is amber/highlighted; older ones are greyed; none are ever removed.
- [ ] A correction's statement reads correctly with no other context on screen.
- [ ] Tapping a correction's source chip smoothly expands the **Source drawer below Corrections (State B)**; Corrections shrinks to the top half; the drawer shows the source excerpt with the phrase highlighted.
- [ ] Closing the drawer returns to State A (Corrections full height).
- [ ] Tapping a different correction's chip swaps the drawer content without closing it.
- [ ] No slide-over overlay or full-page document view exists anywhere.
- [ ] Personal notes accepts a short jot; it appears in the list.
- [ ] Chat w/ Vesper and Next topics render as inert labeled boxes with no input/behavior.
- [ ] Nothing requires a click to keep the call usable.
- [ ] The mock driver runs the full sequence hands-free.

---

## 13. Do NOT (intentional decisions)

- Do NOT build Chat w/ Vesper or Next topics functionality — they are placeholders only.
- Do NOT put newest corrections at the top. New = **bottom**.
- Do NOT make corrections disappear abruptly. Grey first; they leave only by scrolling off the top.
- Do NOT build the Source view as a slide-over overlay or a full-page view — it is an **in-column drawer** below Corrections.
- Do NOT add a transcript panel.
- Do NOT add a settings/preferences screen.
- Do NOT build the speaking state.
- Do NOT use loud animations (pop, flash, bounce, slide-with-overshoot).
- Do NOT require any click to keep the call usable.

---

## 14. Recommended build

If unsure: build as a **single self-contained front-end** (one React component, or one HTML file with vanilla JS) holding `WorkspaceState` in memory, rendering the layout per §3–7, mutated by the mock driver in §10. No backend, no persistence. Keep the demo-script timings and visual tokens at the top of the file so they're easy to tweak live. The drawer's open/closed state drives the left-column split between Corrections and the Source drawer.
