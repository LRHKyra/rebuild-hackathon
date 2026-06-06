// Traces to: spec/product.md §15 (recommended demo knowledge) + §6A + §6B.
// Lane C owns this file. AcmeFlow is the fictional B2B SaaS we demo with: the
// knowledge here is what makes Vesper feel reusable rather than hardcoded.
//
// Two things live here:
//  1. ACMEFLOW_DOCS — the source documents a presenter loads on the Knowledge page.
//     They are POSTed to /api/knowledge (Lane A) where they get chunked + embedded
//     into real KnowledgeCards for live retrieval.
//  2. MOCK_KNOWLEDGE_CARDS — KnowledgeCard-shaped stand-ins used to render the UI
//     before any backend is reachable (the demo-safe path). Mock answer cards in
//     demo-script.ts cite these ids so the "sources" panel resolves to titles.

import type { KnowledgeCard } from "@/types";

// The demo company id. Matches Lane A's DEFAULT_COMPANY so live retrieval and the
// knowledge list line up without extra wiring.
export const DEMO_COMPANY_ID = "demo-company";
export const DEFAULT_AGENT_NAME = "Vesper";
export const DEMO_CALL_ID = "demo-call";

// A source document the presenter can paste/load on the Knowledge page.
export type KnowledgeDoc = {
  id: string; // stable id, also used as the mock KnowledgeCard id
  title: string;
  source: string;
  topicTags: string[];
  text: string;
};

// AcmeFlow knowledge — the facts in product.md §15, organized into the six docs
// product.md §5 lists (overview, security, integrations, implementation, pricing,
// roadmap). Written as prose so chunking + embeddings have real material.
export const ACMEFLOW_DOCS: KnowledgeDoc[] = [
  {
    id: "kc-overview",
    title: "AcmeFlow Product Overview",
    source: "Product Overview",
    topicTags: ["product", "overview"],
    text: `AcmeFlow is an AI workflow automation platform for enterprise operations teams. It connects the tools ops teams already use and automates multi-step processes — approvals, data hand-offs, and routine back-office work — with human-in-the-loop controls. AcmeFlow is delivered as a multi-tenant cloud (SaaS) product. It is designed for large organizations that need reliability, auditability, and enterprise-grade security.`,
  },
  {
    id: "kc-security",
    title: "AcmeFlow Security & Compliance FAQ",
    source: "Security FAQ",
    topicTags: ["security", "compliance", "sso", "scim"],
    text: `Single sign-on (SSO) is generally available via SAML 2.0 and works with major identity providers such as Okta, Azure AD, and Google Workspace. SCIM provisioning for automated user lifecycle management is currently in private beta — it is not generally available yet, and customers who need it confirm beta eligibility during implementation. AcmeFlow has completed SOC 2 Type II. AcmeFlow does not support HIPAA workloads and is not HIPAA compliant today. Audit logs and configurable data retention (up to 7 years) are available. EU data residency is available on the enterprise plan.`,
  },
  {
    id: "kc-integrations",
    title: "AcmeFlow Integrations FAQ",
    source: "Integrations FAQ",
    topicTags: ["integration", "crm"],
    text: `AcmeFlow has live, production integrations with Salesforce and HubSpot for syncing records and triggering workflows. A Workday integration is on the roadmap and not yet available. Beyond packaged integrations, AcmeFlow offers a REST API and webhooks so teams can connect additional systems.`,
  },
  {
    id: "kc-implementation",
    title: "AcmeFlow Implementation FAQ",
    source: "Implementation FAQ",
    topicTags: ["implementation", "deployment"],
    text: `A typical AcmeFlow implementation takes 2 to 4 weeks, including connecting source systems and configuring the first workflows. AcmeFlow is cloud-only: on-premises deployment is not supported, and there is no self-hosted option today. Implementation is guided by a dedicated onboarding specialist on enterprise plans.`,
  },
  {
    id: "kc-pricing",
    title: "AcmeFlow Pricing & Packaging FAQ",
    source: "Pricing FAQ",
    topicTags: ["pricing", "packaging"],
    text: `AcmeFlow is sold in tiered plans, with the enterprise plan adding advanced security and data-residency options. EU data residency is available on the enterprise plan. Volume-based pricing scales with the number of automated workflow runs. Specific list pricing is provided by the sales team during scoping.`,
  },
  {
    id: "kc-roadmap",
    title: "AcmeFlow Roadmap Caveats",
    source: "Roadmap Notes",
    topicTags: ["roadmap", "scim", "integration"],
    text: `Items not yet generally available: SCIM provisioning is in private beta, and the Workday integration is planned but not released. Roadmap items should be positioned as future capabilities, not current functionality. When a customer needs a roadmap item, confirm timelines with product before committing.`,
  },
];

const T0 = "2026-06-06T17:00:00.000Z";

// KnowledgeCard-shaped stand-ins for offline/mock rendering. One card per doc
// (no embeddings — these never hit retrieval). The real cards from /api/knowledge
// will have different ids; the UI looks cards up by id from whichever list it has.
export const MOCK_KNOWLEDGE_CARDS: KnowledgeCard[] = ACMEFLOW_DOCS.map((doc) => ({
  id: doc.id,
  companyId: DEMO_COMPANY_ID,
  title: doc.title,
  source: doc.source,
  topicTags: doc.topicTags,
  text: doc.text,
  createdAt: T0,
}));

// Builds an id -> card lookup so the sources panel can resolve sourceCardIds to
// human-readable titles, regardless of whether the cards are mock or live.
export function cardsById(
  cards: Pick<KnowledgeCard, "id" | "title" | "source" | "text">[],
): Map<string, Pick<KnowledgeCard, "id" | "title" | "source" | "text">> {
  return new Map(cards.map((c) => [c.id, c]));
}
