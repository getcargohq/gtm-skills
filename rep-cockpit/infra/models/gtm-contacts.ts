import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// The shared native contacts model, declared exactly as every pipeline
// declares it (scripts/native-models.json). A project that already has it
// keeps one copy: rewire the imports to it and delete this file.
//
// Each person a claim sources lands here, matched on `linkedin_url`, with
// `account_id` the claimed gtm_accounts row and `lead_source` "rep_cockpit".
export const gtmContacts = defineModel("gtm_contacts", {
  name: "GTM contacts",
  kind: "native",
  extractSlug: "defineContact",
  folder: modelsFolder,
});
