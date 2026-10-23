import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// One row per lookalike company, keyed on domain, written only by the play.
// Every company the researcher returns lands here with a `verdict`, whichever
// gate it stopped at, so a company is judged once and the next month's search
// can exclude it:
//
//   not_viable                     the account gate said no
//   viable_no_contact              nobody at it fits a persona tier
//   viable_email_not_verified      the person's email did not verify
//   viable_contact_not_qualified   verified, but the persona score is short
//   drafted                        a qualified person and an opener, ready
//
// `viable`, `contact_found` and `qualified` are the same row mid-way: each
// stage writes its verdict before the next one starts, so a run that failed
// part way leaves the last stage it finished. Remove that row to have the
// company judged again next month.
//
// Times are ISO 8601 strings, written by the play.
export const lookalikeProspects = defineModel("lookalike_prospects", {
  kind: "native",
  extractSlug: "defineCustom",
  name: "Lookalike prospects",
  description:
    "One row per lookalike company: the account score, the verdict, the contact, the verified email, the persona score and the opener for the ones that qualify.",
  folder: modelsFolder,
  config: {
    columns: [
      { slug: "domain", type: "string" },
      { slug: "company", type: "string" },
      { slug: "linkedin_url", type: "string" },
      { slug: "seed_customer", type: "string" },
      { slug: "seed_domain", type: "string" },
      { slug: "why_similar", type: "string" },
      { slug: "similarity_evidence", type: "string" },
      { slug: "account_fit", type: "number" },
      { slug: "tier", type: "string" },
      { slug: "situation", type: "number" },
      { slug: "urgency", type: "string" },
      { slug: "roles_present", type: "string" },
      { slug: "roles_missing", type: "string" },
      { slug: "coverage_ratio", type: "number" },
      { slug: "verdict", type: "string" },
      { slug: "verdict_reason", type: "string" },
      { slug: "score_evidence", type: "string" },
      { slug: "contact_name", type: "string" },
      { slug: "contact_title", type: "string" },
      { slug: "contact_linkedin", type: "string" },
      { slug: "contact_email", type: "string" },
      { slug: "email_status", type: "string" },
      { slug: "persona_tier", type: "string" },
      { slug: "persona_score", type: "number" },
      { slug: "persona_reason", type: "string" },
      { slug: "subject", type: "string" },
      { slug: "opener", type: "string" },
      { slug: "run_at", type: "string" },
    ],
  },
});
