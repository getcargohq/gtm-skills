import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders/gtm";

// The people side of the base schema. Contract: an `email` string column as the
// identity key.
//
// NATIVE, like accounts: no connector, no env var, so this example deploys on a
// fresh workspace. `defineContact` gives the standard contact schema (name,
// email, title, department, account_id, ...).
//
// Fill it with the contact-sourcing skill, or source it from your CRM: add a CRM connector
// and swap this for a connector-backed model (see accounts.ts for the shape).
export const contacts = defineModel("contacts", {
  kind: "native",
  extractSlug: "defineContact",
  folder: modelsFolder,

  // Native `defineContact` gives id, account_id, first_name, last_name, name,
  // title, department, email, phone, mobile_phone, linkedin_url, lead_source,
  // owner_id, mailing_*, description. These add what the skills write.
  additionalColumns: [
    {
      kind: "custom",
      slug: "owner_assigned_at",
      type: "date",
      label: "Owner assigned at",
      description:
        "When routing last assigned an owner. Drives per-rep capacity.",
    },
    {
      kind: "custom",
      slug: "cargo_last_updated_at",
      type: "date",
      label: "Last enriched at",
      description:
        "When enrichment last refreshed this contact. Drives staleness.",
    },
  ],
});
