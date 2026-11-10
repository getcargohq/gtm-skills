import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// Exa has no extractor, so its source is a list of plain-language searches:
// one row per query, written by the operator, run once by the Exa play.
//
// Write queries the way a buyer would describe the company, not the way a
// database files it: "AI agent platform headquartered in France, 50 to 1,000
// employees, selling to businesses". One query per category and country is
// the shape that worked; Exa returns up to `exaResultsPerQuery` companies each
// (settings.ts).
//
// The play stamps `searched_at`, so a query runs once. Clear it to run a query
// again.
export const tamExaQueries = defineModel("tam_exa_queries", {
  name: "TAM Exa queries",
  kind: "native",
  extractSlug: "defineCustom",
  config: {
    columns: [
      { slug: "query", type: "string" },
      { slug: "searched_at", type: "date" },
    ],
  },
  folder: modelsFolder,
});
