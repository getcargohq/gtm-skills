import { defineConnector } from "@cargo-ai/cdk";

// The CRM the inbound contacts land in, the model extracts, and the play
// writes the brief back onto. HubSpot is the checked shape: Salesforce and
// Attio adapt this file, the extractor config in `../models/crm-contacts.ts`,
// the record-id column and the write action in `../plays/research-inbound.ts`,
// and nothing else.
//
// Bound, not created. `default: true` binds the workspace's authorized HubSpot
// connector rather than minting one, so this pipeline deploys with no key of
// its own.
export const hubspot = defineConnector("hubspot", {
  integration: "hubspot",
  default: true,
});
