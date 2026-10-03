import { defineConnector } from "@cargo-ai/cdk";

// The Slack workspace people @mention the scribe from. OAuth, so bound rather
// than created: a deploy cannot mint the grant. Authorize it once in the
// browser (`cargo-ai cdk add connector/slack`) and `default: true` binds to it.
//
// It does two jobs. It is the trigger: an @mention in a listed channel opens
// one chat per thread, and the platform streams the agent's final text back
// into that thread, so there is no reply to post by hand. And it is the read
// path: `getThread` on the agent's `uses` is how the scribe reads the whole
// thread it was summoned into, not just the message that mentioned it.
export const slack = defineConnector("slack", {
  integration: "slack",
  default: true,
});
