import { defineModel } from "@cargo-ai/cdk";

// The workspace's unified accounts: one row per real company, merged across
// every model that unifies as an account. Here that is the AI Ark universe
// (./tam-companies.ts) and the CRM's companies (./crm-accounts.ts). Each row's
// `ids` column maps the source models it came from, so a sourced company with
// a CRM key in `ids` is already in the CRM, and one without is net new.
//
// ADOPTED, NOT CREATED. Cargo generates this model; declaring it with the
// `unifyAccounts` extractor binds the live one. It is a workspace singleton
// that every other source unifies into, which is why this file declares NO
// `config`: the reference strengths decide merges for the CRM and every other
// source too, and a sourcing skill does not get to change them for everyone.
//
// The live defaults already match on what this skill needs:
//   domain            strong  (the website)
//   linkedinId        strong
//   crunchbaseUuid    strong  (AI Ark returns no Crunchbase field, so it only
//                              merges between other sources that carry one)
//   linkedinHandle    weak    (corroborates, never merges on its own)
//   slug              none    (company names never merge)
// Read the live config before relying on them (`references/configure.md`). A
// workspace that wants LinkedIn handles to merge on their own is the
// `linkedin-handle-merges` variation in SKILL.md, and its owner's decision.
//
// ONE SLUG, TWO MEANINGS. `account-scoring` ships a different model under the
// same slug: a `defineAccount` object model it writes scores into. In a project
// that carries both, they collide at deploy. This one's slug is fixed by Cargo,
// so the object model is the one to rename.
export const accounts = defineModel("accounts", {
  kind: "native",
  extractSlug: "unifyAccounts",
});
