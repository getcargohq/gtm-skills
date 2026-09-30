import { defineConnector } from "@cargo-ai/cdk";

// The Slack workspace this cookbook talks to, in two directions.
//
// The refresh agent posts its five-line digest through
// `slack.actions.postMessage`, with the channel locked on the use (see
// ../agents/context-refresh.ts): a channel the agent could pick is a channel
// it can get wrong, and a context digest in a customer shared channel is the
// one failure here nobody can undo.
//
// The analyst is triggered from Slack: an @mention in a listed channel opens
// a chat with it and the platform streams the answer back into the thread, so
// there is no reply to post and nothing to lock on that side.
//
// OAuth, so bound rather than created: authorize it once in the browser
// (`cargo-ai cdk add connector/slack`) and `default: true` binds to it. A
// deploy cannot mint the grant.
export const slack = defineConnector("slack", {
  integration: "slack",
  default: true,
});
