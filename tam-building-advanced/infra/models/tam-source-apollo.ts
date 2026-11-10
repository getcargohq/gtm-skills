import { defineModel } from "@cargo-ai/cdk";

import { apollo } from "../connectors/apollo";
import { modelsFolder } from "../folders";

// The second census: Apollo's own database, searched with the same brief as
// Sales Navigator. Two independent enumerations of one market are what the
// coverage estimate in references/run.md is computed from.
//
// Apollo has no industry taxonomy: industries are keyword tags, which over-
// and under-match. That is acceptable here because nothing is trusted from the
// source's label: every company is classified from its own description in the
// unify tool. Size the pool with a small `limit` first; there is no free count.
//
// NO SCHEDULE, ON PURPOSE: every sync re-bills every returned record.
export const tamSourceApollo = defineModel("tam_source_apollo", {
  name: "TAM source: Apollo",
  connector: apollo,
  extractSlug: "fetchOrganizations",
  description:
    "TAM source 3 of 4: Apollo organizations for the same brief, the second census.",
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

  // PLACEHOLDER: the same brief in Apollo's filters. Employee ranges are
  // strings in Apollo's "min,max" form; locations are free text.
  config: {
    filters: {
      q_organization_keyword_tags: [
        "saas",
        "b2b software",
        "developer tools",
        "cybersecurity",
      ],
      organization_num_employees_ranges: ["51,200", "201,500", "501,1000"],
      organization_locations: [
        "United States",
        "United Kingdom",
        "France",
        "Germany",
      ],
    },
    // PLACEHOLDER: the budget. Billing is per returned record.
    limit: 1000,
  },
});
