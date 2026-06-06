// Traces to: spec/principles.md §Secrets — "Validate env at request time inside
// the route, not at import/build time, so builds and CI never need real secrets."
//
// IMPORTANT: do not read these at module top-level. Call getServerEnv() inside a
// request handler so a missing key fails the request, not the build.

export type ServerEnv = {
  elevenLabsApiKey: string;
  elevenLabsAgentId: string;
};

// Thrown when a required server-side secret is missing at request time.
export class MissingEnvError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing required environment variable(s): ${missing.join(", ")}`);
    this.name = "MissingEnvError";
  }
}

// Reads and validates server-only secrets. Never expose the return value to the
// client. Throws MissingEnvError listing everything absent.
export function getServerEnv(): ServerEnv {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  const elevenLabsAgentId = process.env.ELEVENLABS_AGENT_ID;

  const missing: string[] = [];
  if (!elevenLabsApiKey) missing.push("ELEVENLABS_API_KEY");
  if (!elevenLabsAgentId) missing.push("ELEVENLABS_AGENT_ID");

  if (missing.length > 0) {
    throw new MissingEnvError(missing);
  }

  // Non-null assertions are safe: the checks above guarantee presence.
  return {
    elevenLabsApiKey: elevenLabsApiKey!,
    elevenLabsAgentId: elevenLabsAgentId!,
  };
}
