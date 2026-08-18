import { defineConnector, secret } from "@cargo-ai/cdk";

// PLACEHOLDER — the CRM slot. Every cookbook's accounts/contacts flow through
// this connector; swap the integration for attio/salesforce if that's where
// your data lives (the downstream contract is only the two models in
// `../models/`). Set HUBSPOT_API_KEY in your environment before deploy —
// `secret()` reads it at deploy time and keeps it out of the content hash.
export const hubspot = defineConnector("hubspot", {
  integration: "hubspot",
  config: { method: "privateApp", accessToken: secret("HUBSPOT_API_KEY") },
});
