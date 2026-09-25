import { defineConnector } from "@cargo-ai/cdk";

// The CRM slot, and the checked example is HubSpot. This skill never writes to
// it: the CRM is here only so its companies join the same unified accounts as
// the sourced ones, which is what turns "companies found" into "companies found,
// and which of them we already have".
//
// Salesforce or Attio replaces the integration and the extractor config in
// ../models/crm-accounts.ts. One CRM shape per project, never parallel branches.
//
// Binds the workspace's DEFAULT HubSpot connector rather than creating one:
// authorize it once (`cargo-ai cdk add connector/hubspot`) and this
// declaration resolves to it.
export const crm = defineConnector("crm", {
  // PLACEHOLDER: the CRM the workspace holds ("hubspot", "salesforce", "attio").
  integration: "hubspot",
  default: true,
});
