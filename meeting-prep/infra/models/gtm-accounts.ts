import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// The companies the meetings are with. A Cargo native account model
// (`defineAccount`: id, name, website, industry, number_of_employees,
// description, owner_id, ...). The briefer matches an external attendee's
// email domain to `website`, and reads a tier off the row when a scoring
// pipeline wrote one.
//
// `gtm_accounts` is a shared native model (scripts/native-models.json): every
// pipeline that needs accounts declares it under this slug, so a project that
// installs several keeps one, with each pipeline's added columns merged. On a
// CRM, swap it for a connector-backed model (`crm-backed` in SKILL.md).
export const gtmAccounts = defineModel("gtm_accounts", {
  name: "GTM accounts",
  kind: "native",
  extractSlug: "defineAccount",
  folder: modelsFolder,
});
