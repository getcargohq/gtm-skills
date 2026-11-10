import { defineModel } from "@cargo-ai/cdk";

import { aiArk } from "../connectors/ai-ark";
import { modelsFolder } from "../folders";

// The lookalikes: companies that look like the customers you name. Filters
// keep them inside the ICP, `lookalikeDomains` points the search at what your
// best customers have in common. This is the source that finds accounts a
// filter search ranks low or files elsewhere.
//
// COUNT BEFORE YOU SOURCE. `aiArk.countCompanies` takes these exact groups,
// `lookalikeDomains` included, and is free. See references/configure.md.
//
// NO SCHEDULE, ON PURPOSE: every sync re-bills every returned record.
export const tamSourceAiArk = defineModel("tam_source_ai_ark", {
  name: "TAM source: AI Ark",
  connector: aiArk,
  extractSlug: "fetchCompanies",
  description:
    "TAM source 2 of 4: AI Ark lookalikes of named customers, inside the ICP filters.",
  folder: modelsFolder,

  additionalColumns: [
    {
      kind: "custom",
      slug: "unified_at",
      type: "date",
      label: "Unified at",
      description:
        "When this row was resolved and written into tam_universe. Empty means not processed yet.",
    },
  ],

  // PLACEHOLDER: the ICP as AI Ark filter groups, plus up to five customer
  // domains. Nested groups, never a flat map: a flat key is ignored silently
  // and you source the whole database up to `limit`. Enum-backed values come
  // from the integration's autocompletes (`listIndustries`).
  config: {
    industry: {
      industry_or: ["software development", "computer and network security"],
    },
    employeeSize: { min_employee_count: 51, max_employee_count: 1000 },
    companyLocation: {
      location_or: ["United States", "United Kingdom", "France", "Germany"],
    },
    lookalikeDomains: [
      "customer-one.example",
      "customer-two.example",
      "customer-three.example",
    ],
    // PLACEHOLDER: the budget. Billing is per returned record.
    limit: 1000,
  },
});
