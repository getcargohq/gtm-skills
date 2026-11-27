import { defineConnector } from "@cargo-ai/cdk";

// The model ask-cargo runs on.
//
// A harness agent does not bring its own model. Claude Code runs inside the
// sandbox with `ANTHROPIC_BASE_URL` pointed at Cargo's proxy and a minted
// session token as its key, and the proxy bills every token to this connector,
// metered against the `languageModel` slug on the agent.
//
// The `claudeCode` integration serves the `claudeCode` harness and nothing
// else. Authenticated with the token `claude setup-token` prints, the run is
// billed to that Claude Pro or Max plan; left without one, it runs on Cargo
// credits.
//
// `default: true` binds the workspace's existing Claude Code connector, the one
// set up once in the UI or with `cargo-ai project add connector/claudeCode`,
// rather than creating one, so this cookbook deploys with no env var of its own.
export const claudeCode = defineConnector("claude_code", {
  integration: "claudeCode",
  default: true,
});
