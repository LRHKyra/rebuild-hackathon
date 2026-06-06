// TODO(spec): product.md — replace with real demo data once product.md is filled.
//
// Thin, idea-agnostic placeholder data. Per principles.md, persistence is static
// fixtures (no database). Keep this small; it exists only so the UI renders
// something concrete before the product idea is chosen.

import type { DemoResult } from "@/types";

export const PLACEHOLDER_RESULT: DemoResult = {
  title: "Result appears here",
  summary:
    "This card is wired to fixtures.ts. Once /spec/product.md is filled in, " +
    "replace this with the real output of the demo's core flow.",
  details: [
    "TODO(spec): product.md §Core Flow — what does the demo produce?",
    "TODO(spec): product.md §Wow moment — what makes a judge lean in?",
  ],
};
