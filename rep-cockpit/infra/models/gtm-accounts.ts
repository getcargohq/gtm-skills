import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// The shared native accounts model, declared exactly as every pipeline
// declares it (scripts/native-models.json). A project that already has it
// keeps one copy: rewire the imports to it and delete this file.
//
// A claim upserts the claimed company here on `website`, so the people it
// sources hang off a real account id and the account unifies into Unify
// Accounts like any other.
export const gtmAccounts = defineModel("gtm_accounts", {
  name: "GTM accounts",
  kind: "native",
  extractSlug: "defineAccount",
  folder: modelsFolder,
});
