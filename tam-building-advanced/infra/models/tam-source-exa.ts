import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// Exa has no extractor, so its source is a native model the operator fills:
// references/run.md runs each query in `exaQueries` (settings.ts) once from the
// CLI and writes one row per company found. No play: a search is a decision,
// not something that should run on a tick.
//
// Exa returns pages, so all a row knows is the website. It reaches Accounts on
// the domain, and the profile play reads the company's LinkedIn page from it.
export const tamSourceExa = defineModel("tam_source_exa", {
  name: "TAM source: Exa",
  kind: "native",
  extractSlug: "defineCustom",
  description:
    "TAM source 4 of 4: companies Exa found for the written queries in settings.ts, one row each.",
  config: {
    columns: [
      { slug: "domain", type: "string" },
      { slug: "url", type: "string" },
      { slug: "title", type: "string" },
      { slug: "query", type: "string" },
      { slug: "searched_at", type: "date" },
    ],
  },
  unification: {
    source: "custom",
    type: "account",
    uniqueColumns: [{ slug: "domain", reference: "domain" }],
  },
  folder: modelsFolder,
});
