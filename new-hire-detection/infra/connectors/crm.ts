import { defineConnector } from "@cargo-ai/cdk";

// The CRM slot, and the checked example is HubSpot. The play looks companies
// and contacts up with `searchRecords`, writes with `upsertRecords` and
// `insertRecord`, and links tasks with `createAssociation`.
//
// Salesforce and Attio replace the integration, the lookups, the routing
// signal, the record IDs and the task write together, in this one file's
// play, following ../../references/crm-adaptation.md. One CRM shape per
// project, never parallel branches. On Salesforce every lookup is
// `findRecords` or `searchRecords`; never `soqlQuery`.
//
// Binds the workspace's DEFAULT HubSpot connector rather than creating one:
// authorize it once (`cargo-ai cdk add connector/hubspot`) and this
// declaration resolves to it.
export const crm = defineConnector("crm", {
  integration: "hubspot",
  default: true,
});
