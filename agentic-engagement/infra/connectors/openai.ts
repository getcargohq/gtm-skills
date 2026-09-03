import { defineConnector } from "@cargo-ai/cdk";

// The LLM provider the engager talks through. Adopted (key-authenticated in
// the workspace). Swap for anthropic/gemini and update the agent's
// `languageModel` accordingly.
//
// The integration slug is "openAi", not "openai". `adopt: true` loosens the
// config type, so the wrong casing typechecks green and only fails at deploy.
export const openai = defineConnector("openai", {
  integration: "openAi",
  adopt: true,
});
