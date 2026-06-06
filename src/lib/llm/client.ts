// Traces to: spec/product.md §12 (prompts) + workstreams.md Lane A.
//
// Shared Anthropic client + a forced-tool-call helper that guarantees structured
// JSON output (the model MUST call the single provided tool, so we get a typed
// object back, not free text to parse). All three LLM functions use this so they
// stay consistent. Server-only (uses ANTHROPIC_API_KEY).
//
// Verified against installed @anthropic-ai/sdk: messages.create({ system: string |
// TextBlockParam[], tools, tool_choice: { type: "tool", name } }); tool_use blocks
// expose `.input`; TextBlockParam supports cache_control for prompt caching.

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/env";

// Model routing (research-backed): cheap+fast Haiku on the frequent/low-latency
// tasks, Sonnet for the quality-critical grounded answer.
export const MODELS = {
  detect: "claude-haiku-4-5",
  answer: "claude-sonnet-4-6",
  contradiction: "claude-haiku-4-5",
} as const;

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: getAnthropicApiKey() });
  return client;
}

export type StructuredCallOptions = {
  model: string;
  // System prompt. When `cacheSystem` is true it's sent as a cached block so the
  // repeated system + knowledge context is billed at ~0.1x and lowers TTFT.
  system: string;
  messages: Anthropic.MessageParam[];
  // Single tool whose input_schema defines the JSON we want back.
  tool: Anthropic.Tool;
  maxTokens?: number;
  cacheSystem?: boolean;
};

// Result of a structured call, including the parsed value plus raw output and
// token usage for observability (logging, cost tracking, eval harnesses).
export type StructuredResult<T> = {
  value: T;
  raw: unknown;
  usage: Anthropic.Usage;
  stopReason: string | null;
  model: string;
};

// Calls Claude forcing the single tool, returning the typed tool input along
// with the raw tool input, token usage, stop reason, and model. Throws if the
// model fails to produce the tool call.
export async function callStructuredDebug<T>(
  opts: StructuredCallOptions,
): Promise<StructuredResult<T>> {
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: opts.system,
      ...(opts.cacheSystem ? { cache_control: { type: "ephemeral" } } : {}),
    },
  ];

  const response = await getAnthropic().messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1024,
    system,
    messages: opts.messages,
    tools: [opts.tool],
    tool_choice: { type: "tool", name: opts.tool.name },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return the expected structured tool call.");
  }
  return {
    value: toolUse.input as T,
    raw: toolUse.input,
    usage: response.usage,
    stopReason: response.stop_reason,
    model: response.model,
  };
}

// Calls Claude forcing the single tool, and returns the tool input typed as T.
// Throws if the model fails to produce the tool call. Drop-in helper for callers
// that only need the parsed value; see callStructuredDebug for usage/raw output.
export async function callStructured<T>(opts: StructuredCallOptions): Promise<T> {
  return (await callStructuredDebug<T>(opts)).value;
}
