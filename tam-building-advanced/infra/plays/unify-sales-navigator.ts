import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { playsFolder } from "../folders";
import { tamSourceSalesNavigator } from "../models/tam-source-sales-navigator";
import { tamUnifyCompany } from "../tools/unify-company";

// Every account the Sales Navigator searches returned goes through the one
// door into the TAM. The row already carries the LinkedIn company id, so the
// LinkedIn URL is built from it, never guessed from a name.
const unifySalesNavigatorAccount = defineWorkflow(
  "tam_unify_sales_navigator_account",
  {
    input: z.object({
      _id: z.string(),
      sales_navigator_company_id: z.string(),
    }),
    output: z.object({ result: z.string() }),
    uses: { tamUnifyCompany },
    imports: { tamSourceSalesNavigator },
  },
  ({ input, uses, model }) => {
    const unified = uses.tamUnifyCompany({
      source: "sales_navigator",
      linkedin_url: `https://www.linkedin.com/company/${input.sales_navigator_company_id}`,
      domain: "",
    });
    model.customColumn({
      modelUuid: tamSourceSalesNavigator.uuid,
      // The row's Cargo record id is `_id`. `id` is a column some sources
      // carry (AI Ark's own id), and Sales Navigator rows have none at all.
      id: input._id,
      mappings: [{ columnSlug: "unified_at", value: new Date() }],
    });
    return { result: unified.result };
  },
);

// Sources run in order, Sales Navigator first: it is the largest census, so
// every later source mostly finds companies the TAM already holds, which cost
// nothing to recognise. Ships disabled: enable it after the first sync.
export const unifySalesNavigator = definePlay("tam_unify_sales_navigator", {
  name: "TAM: unify Sales Navigator",
  description:
    "Send every Sales Navigator account through the unify tool into tam_universe.",
  folder: playsFolder,
  model: tamSourceSalesNavigator,
  workflow: unifySalesNavigatorAccount,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "date",
            columnSlug: tamSourceSalesNavigator.columns.custom__unified_at,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug:
              tamSourceSalesNavigator.columns.sales_navigator_company_id,
            operator: "isNotEmpty",
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "5 * * * *" },
});
