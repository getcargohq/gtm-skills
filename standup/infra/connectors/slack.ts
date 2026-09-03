import { defineConnector } from "@cargo-ai/cdk";

// The Slack workspace the digest is posted into. OAuth, so adopted: a deploy
// cannot mint the grant. Authorize it once in the browser
// (`cargo-ai cdk add connector/slack`) and this declaration binds to it.
//
// This is the only Slack path the agent has. There is no SLACK_TOKEN, no
// chat.postMessage script, and no GitHub Action. The agent calls
// `slack.actions.postMessage` (channel locked on the use) the same way the
// engager calls native `sendEmail`. Wrapping that one action in a tool would
// be ceremony this repo refuses.
export const slack = defineConnector("slack", {
  integration: "slack",
  adopt: true,
});
