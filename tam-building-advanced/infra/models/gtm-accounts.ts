import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// The shared GTM accounts model, declared exactly as every pipeline declares
// it (scripts/native-models.json). A project that installs several pipelines
// keeps one: rewire the imports to the first copy and drop the others.
//
// Read only. The unify tool looks each company up here by domain to mark it
// `in_crm` or net new. Most installs take the `crm-backed` variation instead,
// which reads the HubSpot or Salesforce companies directly (see SKILL.md).
export const gtmAccounts = defineModel("gtm_accounts", {
  name: "GTM accounts",
  kind: "native",
  extractSlug: "defineAccount",
  folder: modelsFolder,
});
