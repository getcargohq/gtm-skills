import { defineConnector } from "@cargo-ai/cdk";

// Where a person approves every reply. The native Human Review node posts
// through this connector and holds the run until a reviewer clicks Approve,
// Edit or Decline, so this is the only path from a draft to a sent reply
// unless a class is switched to Reply Mode in `infra/settings.ts`.
//
// Binds the workspace's default Slack connector rather than creating one:
// authorize it once (`cargo-ai project add connector/slack`) and this
// declaration resolves to it. Invite the Cargo app to the review channel, or
// the post fails.
export const slack = defineConnector("slack", {
  integration: "slack",
  default: true,
});
