import { defineConnector } from "@cargo-ai/cdk";

// The CRM slot. The checked example is HubSpot: `fetchRecords` extracts the
// account model, `findRecords` searches for live duplicates, and `mergeRecords`
// performs the merge. Salesforce or Attio replaces the integration, the
// extractor, the record-ID field, and both action slugs — one CRM shape per
// project, never parallel branches.
//
// Adopted, not created: authorize it once (`cargo-ai cdk add connector/hubspot`)
// and this declaration binds to it.
//
// The 15-day cache is the maximum the connector allows, and it costs nothing
// here: every merge decision reads the CRM live through `findRecords` rather
// than through the cached extract.
export const crm = defineConnector("crm", {
  integration: "hubspot",
  adopt: true,
  cacheTtlMilliseconds: 15 * 24 * 60 * 60 * 1000,
});
