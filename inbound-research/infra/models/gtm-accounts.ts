import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// The companies the inbound contacts belong to, joined on the contact's
// `account_id`. NATIVE, like contacts: `defineAccount` gives id, name, website,
// industry, number_of_employees, owner_id, ...
//
// The play reads the account to hand the researcher what is already known,
// and seeds `tier` only when it is blank: account-scoring or a rep may
// have set it on more evidence than one inbound lead carries.
//
// `gtm_accounts` is a shared native model (scripts/native-models.json): every
// pipeline that needs accounts declares it under this slug, so a project that
// installs several keeps one, with each pipeline's added columns merged.
export const gtmAccounts = defineModel("gtm_accounts", {
  name: "GTM accounts",
  kind: "native",
  extractSlug: "defineAccount",
  folder: modelsFolder,
  additionalColumns: [
    {
      kind: "custom",
      slug: "tier",
      type: "string",
      label: "Tier",
      description: "A, B, C or disqualified against the tiering rubric.",
    },
    {
      kind: "custom",
      slug: "tier_reason",
      type: "string",
      label: "Tier reason",
      description: "The rubric lines that decided the tier.",
    },
  ],
});
