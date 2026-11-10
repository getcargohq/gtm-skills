import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// The TAM: one row per company, keyed on the LinkedIn company id, whichever
// source found it and however many did. Every row was resolved to its LinkedIn
// page and read from there, so the columns mean the same thing on every row.
//
// Nothing is deleted. A company outside the ICP stays, with `status` and
// `exclusion_reason`, so the report can say what each source returned that was
// not your market. Read the TAM as `status = 'in_scope'`.
//
// The four `found_by_*` flags are the provenance. Their sum is how many
// sources found the company, which is a fit signal in its own right: read it
// in references/run.md before you throw the overlap away as duplicates.
export const tamUniverse = defineModel("tam_universe", {
  name: "TAM universe",
  kind: "native",
  extractSlug: "defineCustom",
  config: {
    columns: [
      { slug: "linkedin_company_id", type: "string" },
      { slug: "linkedin_url", type: "string" },
      { slug: "name", type: "string" },
      { slug: "domain", type: "string" },
      { slug: "website", type: "string" },
      { slug: "hq_country", type: "string" },
      { slug: "hq_city", type: "string" },
      { slug: "employee_count", type: "number" },
      { slug: "linkedin_industry", type: "string" },
      { slug: "description", type: "string" },
      { slug: "category", type: "string" },
      { slug: "status", type: "string" },
      { slug: "exclusion_reason", type: "string" },
      { slug: "in_crm", type: "boolean" },
      { slug: "crm_account_id", type: "string" },
      { slug: "found_by_sales_navigator", type: "boolean" },
      { slug: "found_by_ai_ark", type: "boolean" },
      { slug: "found_by_apollo", type: "boolean" },
      { slug: "found_by_exa", type: "boolean" },
      { slug: "first_source", type: "string" },
      { slug: "first_seen_at", type: "date" },
      { slug: "last_seen_at", type: "date" },
    ],
  },
  folder: modelsFolder,
});
