import { defineConnector } from "@cargo-ai/cdk";

// The shared alert channel. Slack is OAuth-authenticated, so tokens can't live
// in the repo — `adopt: true` links the workspace's existing Slack connector
// (connect Slack once in the Cargo UI before deploying). Skills import this
// handle; they never define their own.
export const slack = defineConnector("slack", {
  integration: "slack",
  adopt: true,
});
