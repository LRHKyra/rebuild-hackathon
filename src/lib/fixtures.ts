// Traces to: spec/product.md §15 (demo knowledge) + workstreams.md Lane B/C.
// AcmeFlow demo KB. Auto-seeded on first request so the store is never empty
// after a server restart. Call ensureDemoKnowledge() from any route handler.

import { getStore } from "@/lib/store";
import { chunkText } from "@/lib/chunk";
import { embedQuery } from "@/lib/embeddings";

const COMPANY_ID = "demo-company";

const DEMO_DOCS = [
  {
    title: "AcmeFlow Security & Compliance FAQ",
    source: "security-faq.md",
    text: `AcmeFlow supports SSO through SAML 2.0, which is generally available today.
SCIM user provisioning is currently in private beta and not generally available. Customers who need automated user provisioning should confirm beta eligibility during implementation.
AcmeFlow has completed SOC 2 Type II certification.
HIPAA is not supported today.
EU data residency is available on the enterprise plan.`,
  },
  {
    title: "AcmeFlow Integrations FAQ",
    source: "integrations-faq.md",
    text: `Salesforce and HubSpot integrations are live and generally available.
Workday integration is on the roadmap but not yet live.
AcmeFlow connects via REST API and supports webhook-based event streaming.`,
  },
  {
    title: "AcmeFlow Implementation & Deployment FAQ",
    source: "implementation-faq.md",
    text: `Typical implementation takes 2 to 4 weeks depending on integration complexity.
Data retention is configurable up to 7 years.
On-premise deployment is not supported. AcmeFlow is a cloud-only platform.
Implementation includes dedicated onboarding support and a technical project manager.`,
  },
  {
    title: "AcmeFlow Product Overview",
    source: "product-overview.md",
    text: `AcmeFlow is an AI workflow automation platform built for enterprise operations teams.
It connects to existing business systems, automates repetitive workflows, and surfaces insights across departments.
AcmeFlow is designed for non-technical operations staff — no code required for most automations.
Pricing is on an enterprise subscription model; contact sales for custom packaging.`,
  },
];

let seeded = false;

export async function ensureDemoKnowledge(): Promise<void> {
  if (seeded) return;
  const store = getStore();
  const existing = await store.list(COMPANY_ID);
  if (existing.length > 0) {
    seeded = true;
    return;
  }

  for (const doc of DEMO_DOCS) {
    const chunks = chunkText(doc.text);
    for (const chunk of chunks) {
      const embedding = await embedQuery(chunk);
      await store.add([{
        id: crypto.randomUUID(),
        companyId: COMPANY_ID,
        title: doc.title,
        source: doc.source,
        topicTags: ["demo", "acmeflow"],
        text: chunk,
        embedding,
        createdAt: new Date().toISOString(),
      }]);
    }
  }

  seeded = true;
}
