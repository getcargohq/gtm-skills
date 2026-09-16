import { defineConnector } from "@cargo-ai/cdk";

// The model the scribe runs on.
//
// A harness agent does not bring its own model. Claude Code runs inside the
// sandbox with `ANTHROPIC_BASE_URL` pointed at Cargo's proxy and a minted
// session token as its key, so every token it spends is billed to this
// connector and metered against the `languageModel` slug below. Omit either and
// the release has no runtime to deploy.
//
// The connector's integration is also what selects the proxy: `anthropic` for
// `claudeCode`, `openCode` and `deepAgents`, `openAi` for `codex`. Pairing a
// harness with the wrong integration typechecks green and fails at deploy.
//
// Adopted (key-authenticated once in the workspace UI), so this cookbook
// deploys with no env var of its own.
export const anthropic = defineConnector("anthropic", {
  integration: "anthropic",
  adopt: true,
});
