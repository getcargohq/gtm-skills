import { defineConnector } from "@cargo-ai/cdk";

// The CRM slot, and the checked example is HubSpot: `fetchRecords` extracts the
// account model and `updateRecords` performs the only write in this skill.
// Salesforce or Attio replaces the integration, the extractor, the record-ID
// field, the write action, and the fill-blank guard — one CRM shape per
// project, never parallel branches.
//
// Binds the workspace's DEFAULT HubSpot connector rather than creating one:
// authorize it once (`cargo-ai cdk add connector/hubspot`) and this
// declaration resolves to it.
export const crm = defineConnector("crm", {
  integration: "hubspot",
  default: true,
});
