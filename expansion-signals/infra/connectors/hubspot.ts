import { defineConnector } from "@cargo-ai/cdk";

// The CRM the customers live in: read by the two models, written by the play.
// HubSpot is the checked shape; Salesforce and Attio adapt this file, the two
// extractors, the record-id matching property and the write action, and
// nothing else.
//
// Bound, not created. `default: true` binds the workspace's authorized HubSpot
// connector, so this pipeline deploys with no key of its own.
export const hubspot = defineConnector("hubspot", {
  integration: "hubspot",
  default: true,
});
