import { defineConnector } from "@cargo-ai/cdk";

// The LLM behind the tiering agent. Adopted (key-authenticated once in the
// workspace UI), so this example deploys with no env var.
//
// Swap it for OpenAI by changing `integration` to "openAi" and the agent's
// `languageModel` with it. The integration slug is "openAi", not "openai", and
// `adopt: true` loosens the config type: the wrong casing typechecks green and
// only fails at deploy.
export const anthropic = defineConnector("anthropic", {
  integration: "anthropic",
  adopt: true,
});
