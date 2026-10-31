import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// Who works which account: one row per company, keyed by its domain. The
// cockpit reads it to hide what a teammate already claimed, and writes it on
// Claim, Pass and Release; the claim tool writes it again when sourcing ends.
//
// Keyed by domain, not by an account id, because the queue reads Unify
// Accounts and the claim lands on gtm_accounts: the domain is the one key both
// sides hold. One row per domain means the newest click wins, which is what
// "release it back to the team" needs.
export const cockpitClaims = defineModel("cockpit_claims", {
  name: "Cockpit claims",
  kind: "native",
  extractSlug: "defineCustom",
  config: {
    columns: [
      { slug: "account_domain", type: "string" },
      { slug: "account_name", type: "string" },
      // gtm_accounts.id, once the claim tool has upserted the account.
      { slug: "account_id", type: "string" },
      // The Cargo login email of the rep who clicked.
      { slug: "rep_email", type: "string" },
      // claimed | passed | released
      { slug: "status", type: "string" },
      { slug: "status_at", type: "date" },
      // running | ready | failed, while and after the claim tool sources.
      { slug: "sourcing_status", type: "string" },
      { slug: "contacts_found", type: "number" },
    ],
  },
  folder: modelsFolder,
});
