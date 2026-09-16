import { defineConnector, secret } from "@cargo-ai/cdk";

// PLACEHOLDER — the CRM slot. Every skill's accounts/contacts flow through
// this connector; swap the integration for attio/salesforce if that's where
// your data lives (the downstream contract is only the two models in
// `../models/`). Set HUBSPOT_API_KEY in your environment before deploy —
// `secret()` reads it at deploy time and keeps it out of the content hash.
//
// The only connector here that CREATES rather than binds, which is why it is
// the only one without `default: true`. The two are exclusive: `default: true`
// links the integration's existing connector and never sends a declared
// `config`, so adding it would leave HUBSPOT_API_KEY unread and fail outright
// in a workspace with no HubSpot connection to link. Bind instead of creating
// only once the credential lives in the workspace rather than in .env — that is
// what `crm-enrichment` does with the same integration.
export const hubspot = defineConnector("hubspot", {
  integration: "hubspot",
  config: { method: "privateApp", accessToken: secret("HUBSPOT_API_KEY") },
});
