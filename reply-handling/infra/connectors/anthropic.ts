import { defineConnector } from "@cargo-ai/cdk";

// The LLM behind the classifier and the writer. Bound, not created: `default:
// true` links the workspace's existing Anthropic connector (key-authenticated
// once in the UI), so this example deploys with no env var of its own.
//
// Any LLM connector the workspace holds works: change `integration` here and
// `languageModel` on both agents. Test the writer once after a swap. It asks
// for structured output while it also reads the workspace context, and not
// every provider allows both on one call: Gemini answers "Function calling
// with a response mime type: 'application/json' is unsupported", which is
// what the build this example comes from ran into.
export const anthropic = defineConnector("anthropic", {
  integration: "anthropic",
  default: true,
});
