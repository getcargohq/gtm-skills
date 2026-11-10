import { defineConnector } from "@cargo-ai/cdk";

// The Slack workspace findings are posted into, and read back from. OAuth, so
// bound rather than created: a deploy cannot mint the grant. Authorize it once
// in the browser (`cargo-ai project add connector/slack`) and `default: true`
// binds to it.
//
// This is the only Slack path the agent has. There is no SLACK_TOKEN, no
// chat.postMessage script, and no GitHub Action. The agent calls
// `slack.actions.postMessage` and `slack.actions.getConversationHistory`, both
// with the channel locked on the use. Wrapping either in a tool would be
// ceremony this repo refuses.
export const slack = defineConnector("slack", {
  integration: "slack",
  default: true,
});
