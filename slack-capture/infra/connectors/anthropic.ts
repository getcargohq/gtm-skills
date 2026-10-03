import { defineConnector } from "@cargo-ai/cdk";

// The model the scribe runs on.
//
// A harness agent does not bring its own model. Claude Code runs inside the
// sandbox against Cargo's LLM proxy, so every token it spends is billed to this
// connector and metered against the `languageModel` slug on the agent.
//
// The connector's integration also selects the proxy: `anthropic` for
// `claudeCode`. Pairing the harness with an `openAi` connector typechecks green
// and fails at deploy.
//
// `default: true` binds the workspace's existing Anthropic connector rather
// than creating one, so this pipeline deploys with no env var of its own.
export const anthropic = defineConnector("anthropic", {
  integration: "anthropic",
  default: true,
});
