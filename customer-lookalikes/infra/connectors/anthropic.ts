import { defineConnector } from "@cargo-ai/cdk";

// The LLM behind the four agents. Bound, not created: `default: true` links
// the workspace's existing Anthropic connector (key-authenticated once in the
// UI), so this example deploys with no env var of its own.
//
// Any LLM connector the workspace holds works: change `integration` here and
// `languageModel` on the agents. Three of them read the workspace context and
// return structured JSON on the same call, and not every provider allows both
// at once (Gemini refuses it), so test one agent after a swap.
export const anthropic = defineConnector("anthropic", {
  integration: "anthropic",
  default: true,
});
