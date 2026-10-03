import { defineConnector } from "@cargo-ai/cdk";

// The CRM the deals live in. HubSpot is the checked shape: Salesforce and Attio
// adapt this file, the extractor's object type in `../models/crm-deals.ts`, and
// the property names the prompt's SQL reads, and nothing else.
//
// Bound, not created. `default: true` binds the workspace's authorized HubSpot
// connector, so this pipeline deploys with no key of its own. It is read-only
// here: the model extracts through it and the agent reads notes through
// `searchRecords` and `getRecord`. No write action is on the agent.
export const hubspot = defineConnector("hubspot", {
  integration: "hubspot",
  default: true,
});
