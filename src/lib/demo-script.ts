// Traces to: spec/product.md §16 (demo script) + §6B (panel) + §13 (contracts).
// Lane C owns this file. It is the rehearsed, demo-safe path: a fixed sequence of
// scenes, each carrying the transcript line to speak/type and the §13-shaped
// analysis it should produce. Because the analysis is baked in, the full demo runs
// end to end with ZERO backend (the "mock" mode), and judges still see real voice
// on summon (the spoken text is sent to /api/tts). When Lane B's
// /api/call/transcript lands, the workspace's "live" mode produces the same shapes
// for real.

import type {
  AnswerCard,
  CorrectionCard,
  DetectedQuestion,
  Speaker,
  TranscriptAnalysis,
} from "@/types";
import { DEMO_CALL_ID } from "@/lib/fixtures";

const T = "2026-06-06T17:05:00.000Z";

// ── Mock analysis pieces (cite MOCK_KNOWLEDGE_CARDS ids from fixtures.ts) ───────

const Q_SSO_SCIM: DetectedQuestion = {
  id: "dq-sso-scim",
  callId: DEMO_CALL_ID,
  question: "Do you support SSO and SCIM?",
  speaker: "prospect",
  transcriptWindow:
    "Prospect: Do you support SSO and SCIM? Our IT team will ask.",
  status: "new",
  category: "security",
  createdAt: T,
};

const A_SSO_SCIM: AnswerCard = {
  id: "ac-sso-scim",
  callId: DEMO_CALL_ID,
  questionId: Q_SSO_SCIM.id,
  answer:
    "Yes. AcmeFlow supports SSO through SAML 2.0 today, with providers like Okta and Azure AD. SCIM is currently in private beta, so for customers who need automated user provisioning we'd confirm beta eligibility during implementation.",
  sourceCardIds: ["kc-security"],
  confidence: "high",
  canSpeak: true,
  createdAt: T,
};

const CORRECTION_SCIM: CorrectionCard = {
  id: "cc-scim",
  callId: DEMO_CALL_ID,
  repStatement: "And just to confirm, SCIM is fully generally available.",
  issue:
    "Docs say SCIM is in private beta, not generally available. Stating it is fully GA overstates the current capability.",
  suggestedCorrection:
    "SCIM is in private beta — automated provisioning isn't generally available yet, but we can confirm beta eligibility during implementation.",
  sourceCardIds: ["kc-security"],
  severity: "high",
  createdAt: T,
};

const Q_ONPREM: DetectedQuestion = {
  id: "dq-onprem",
  callId: DEMO_CALL_ID,
  question: "Can you deploy fully on-prem?",
  speaker: "prospect",
  transcriptWindow: "Prospect: Can you deploy fully on-prem?",
  status: "new",
  category: "implementation",
  createdAt: T,
};

const A_ONPREM: AnswerCard = {
  id: "ac-onprem",
  callId: DEMO_CALL_ID,
  questionId: Q_ONPREM.id,
  answer:
    "Not confirmed as supported — our docs say AcmeFlow is cloud-only and does not support on-premises deployment today.",
  sourceCardIds: ["kc-implementation"],
  // canSpeak is true (this is a grounded, confident answer), but it is NEVER
  // summoned in the script — that is the whole point of Scene 4: Vesper stays
  // private because no one called its name (product.md §16, §6B).
  confidence: "high",
  canSpeak: true,
  createdAt: T,
};

// ── The script ─────────────────────────────────────────────────────────────────

export type DemoScene = {
  id: string;
  title: string;
  // Presenter-facing note shown above the controls.
  narration: string;
  // The transcript line this scene adds (omitted for setup/close scenes).
  line?: { speaker: Speaker; text: string };
  // The §13-shaped analysis the line produces (mock). Omitted = no panel change.
  analysis?: TranscriptAnalysis;
  // When true, Vesper is summoned and speaks `spokenText` aloud (TTS).
  summon?: boolean;
  spokenText?: string;
  // When true, the workspace should switch to the Knowledge tab for this scene.
  showKnowledge?: boolean;
};

export const DEMO_SCRIPT: DemoScene[] = [
  {
    id: "scene-1",
    title: "Scene 1 — Setup",
    narration:
      "First we load Vesper with company knowledge. This is what makes it reusable across any company or expert role. Show the uploaded docs and the knowledge cards.",
    showKnowledge: true,
  },
  {
    id: "scene-2-question",
    title: "Scene 2 — Live question",
    narration:
      "The prospect asks a technical question. Vesper privately detects it, retrieves the answer, and shows it in the panel — silently. Nothing is spoken yet.",
    line: {
      speaker: "prospect",
      text: "Do you support SSO and SCIM? Our IT team will ask.",
    },
    analysis: { detectedQuestion: Q_SSO_SCIM, answerCard: A_SSO_SCIM },
  },
  {
    id: "scene-2-summon",
    title: "Scene 2 — Summon",
    narration:
      'The rep invites Vesper by name. Now — and only now — Vesper speaks the grounded answer aloud, synthesized live.',
    line: { speaker: "rep", text: "Vesper, can you take that one?" },
    summon: true,
    spokenText: A_SSO_SCIM.answer,
  },
  {
    id: "scene-3",
    title: "Scene 3 — Private correction",
    narration:
      "The rep misstates a fact. Vesper privately flags the contradiction with a suggested correction — never out loud. The rep corrects themselves.",
    line: {
      speaker: "rep",
      text: "And just to confirm, SCIM is fully generally available.",
    },
    analysis: { correctionCard: CORRECTION_SCIM },
  },
  {
    id: "scene-4",
    title: "Scene 4 — Unsupported question (private, not spoken)",
    narration:
      "A question Vesper can answer — but it was NOT summoned, so it stays private. The panel shows the grounded answer and that Vesper is ready to answer if summoned. Vesper says nothing aloud.",
    line: { speaker: "prospect", text: "Can you deploy fully on-prem?" },
    analysis: { detectedQuestion: Q_ONPREM, answerCard: A_ONPREM },
  },
  {
    id: "scene-close",
    title: "Close",
    narration:
      "This starts as a sales engineer for live calls, but the platform is broader: any company can load a knowledge base and create an expert that supports humans in high-stakes conversations.",
  },
];
