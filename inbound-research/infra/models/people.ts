import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// The people who reached out. A NATIVE model: a workspace-owned contacts table
// with no external source, so this example deploys with no CRM and no key.
// `defineContact` gives the standard schema (id, account_id, first_name,
// last_name, name, title, email, linkedin_url, lead_source, owner_id,
// description, ...).
//
// Rows arrive from whatever captures your inbound: a form or webhook posting
// into this model, a CSV upload, `cargo-ai storage record create`, or another
// pipeline. The play only cares that a new row appears.
//
// The four columns below are what the play writes. Declared bare here; the
// read side (filters, SQL) sees them as `custom__<slug>`.
//
// Running a CRM instead? The `crm-backed` variation in SKILL.md swaps this for
// a connector-backed model and writes back by CRM record id.
export const people = defineModel("people", {
  kind: "native",
  extractSlug: "defineContact",
  folder: modelsFolder,
  additionalColumns: [
    {
      kind: "custom",
      slug: "cargo_inbound_tier",
      type: "string",
      label: "Inbound tier",
      description: "A, B, C or disqualified against the tiering rubric.",
    },
    {
      kind: "custom",
      slug: "cargo_inbound_brief",
      type: "string",
      label: "Inbound brief",
      description:
        "Three sentences: who they are, what the company does, why now.",
    },
    {
      kind: "custom",
      slug: "cargo_inbound_rationale",
      type: "string",
      label: "Inbound rationale",
      description: "The rubric lines that decided the tier.",
    },
    {
      kind: "custom",
      slug: "cargo_inbound_researched_at",
      type: "date",
      label: "Researched at",
      description:
        "When the play researched this contact. The play filter reads it, so a contact is researched once.",
    },
  ],
});
