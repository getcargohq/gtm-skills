import { defineConnector } from "@cargo-ai/cdk";

// The model the researcher runs on. Every inbound contact's research is billed
// to this connector and metered against the agent's `languageModel` slug.
//
// `default: true` binds the workspace's existing Anthropic connector rather
// than creating one, so this pipeline deploys with no env var of its own.
export const anthropic = defineConnector("anthropic", {
  integration: "anthropic",
  default: true,
});
