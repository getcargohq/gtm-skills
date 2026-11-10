import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { exa } from "../connectors/exa";
import { playsFolder } from "../folders";
import { tamExaQueries } from "../models/tam-exa-queries";
import { websiteDomain } from "../scripts/website-domain";
import { exaResultsPerQuery } from "../settings";
import { tamUnifyCompany } from "../tools/unify-company";

// One written query in, up to `exaResultsPerQuery` companies out. Exa returns
// pages, so each result is reduced to its domain and sent through the unify
// tool, which resolves it to the company's LinkedIn page.
const searchExaQuery = defineWorkflow(
  "tam_search_exa_query",
  {
    input: z.object({ query: z.string() }),
    output: z.object({ searched: z.boolean() }),
    uses: { exa, tamUnifyCompany },
    imports: { tamExaQueries, exaResultsPerQuery, websiteDomain },
  },
  ({ input, uses, model }) => {
    const found = uses.exa.search({
      query: input.query,
      category: "company",
      searchType: "auto",
      numResults: exaResultsPerQuery,
    });
    for (const result of found.results) {
      uses.tamUnifyCompany({
        source: "exa",
        linkedin_url: "",
        domain: websiteDomain({ url: result.url }),
      });
    }
    model.update({
      modelUuid: tamExaQueries.uuid,
      matchingColumnSlug: "query",
      matchingValue: input.query,
      mappings: [{ columnSlug: "searched_at", value: new Date() }],
    });
    return { searched: true };
  },
);

// Last in the order: Exa finds the companies filed under industries nobody
// filters on, and by now most of what it returns is already in the TAM.
// Ships disabled: enable it after the Apollo play has finished.
export const searchExa = definePlay("tam_search_exa", {
  name: "TAM: search Exa",
  description:
    "Run each written Exa query once and send every company it finds through the unify tool into tam_universe.",
  folder: playsFolder,
  model: tamExaQueries,
  workflow: searchExaQuery,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "date",
            columnSlug: tamExaQueries.columns.searched_at,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug: tamExaQueries.columns.query,
            operator: "isNotEmpty",
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "50 * * * *" },
});
