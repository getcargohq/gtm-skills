import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// Who works which account: one row per company, keyed by its domain. The
// cockpit reads it to hide what a teammate already claimed, and writes it on
// Claim, Pass and Release; the claim tool writes it again when sourcing ends.
// A pass carries its reason, and a pass on timing a date: past it, the
// account is back in Hot accounts.
//
// Keyed by domain, the key Unify Accounts matches companies on: the cockpit
// joins every table it reads to the unified account by it, and holds no other
// account id. One row per domain means the newest click wins, which is what
// "release it back to the team" needs.
export const cockpitClaims = defineModel("cockpit_claims", {
  name: "Cockpit claims",
  kind: "native",
  extractSlug: "defineCustom",
  config: {
    columns: [
      { slug: "account_domain", type: "string" },
      { slug: "account_name", type: "string" },
      // The Cargo login email of the rep who clicked.
      { slug: "rep_email", type: "string" },
      // The rep's name as the writer signs with it.
      { slug: "rep_name", type: "string" },
      // What the queue knew when the account was claimed: tier and its reason,
      // readiness and its signals. The writer reads it for every draft.
      { slug: "account_context", type: "string" },
      // claimed | passed | released
      { slug: "status", type: "string" },
      { slug: "status_at", type: "date" },
      // no_fit | not_now | in_touch, on a pass.
      { slug: "pass_reason", type: "string" },
      // When a not_now pass returns the account to Hot accounts.
      { slug: "parked_until", type: "date" },
      // running | ready | failed, while and after the claim tool sources.
      { slug: "sourcing_status", type: "string" },
      { slug: "contacts_found", type: "number" },
    ],
  },
  folder: modelsFolder,
});
