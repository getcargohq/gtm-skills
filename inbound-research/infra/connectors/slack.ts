import { defineConnector } from "@cargo-ai/cdk";

// The Slack workspace the inbound notes land in. OAuth, so bound rather than
// created: a deploy cannot mint the grant. Authorize it once in the browser
// (`cargo-ai cdk add connector/slack`) and `default: true` binds to it.
//
// The play posts through `postMessage` with the channel fixed in the workflow.
// There is no SLACK_TOKEN and no wrapped tool.
export const slack = defineConnector("slack", {
  integration: "slack",
  default: true,
});
