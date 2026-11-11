import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { valuesFromRow } from "../compute/values-from-row";
import { playsFolder } from "../folders";
import { fitModel } from "../model";
import { tamCompanies } from "../models/tam-companies";
import { scoreAccount } from "../tools/score-account";

// A new model version, applied to the values already on the row: no provider
// call, no research, only the scoring agent's explanation per company. This is
// what runs after every rebuild of scoring.md that keeps the same attributes.
// A model that adds an attribute needs that attribute collected first: run the
// scoring play's workflow over the book instead (references/run.md).
//
// Its input is every stored value column, generated from the model, because a
// workflow reads the row through the columns its input names.
const storedValues = Object.fromEntries(
  fitModel.attributes.map((attribute) => [
    `custom__fit_${attribute.slug}`,
    attribute.type === "number"
      ? z.number().nullable().optional()
      : z.string().nullable().optional(),
  ]),
);

const rescoreAccountRow = defineWorkflow(
  "rescore_account_row",
  {
    input: z.object({
      id: z.string(),
      name: z.string(),
      domain: z.string(),
      ...storedValues,
    }),
    output: z.object({ grade: z.string(), score: z.number() }),
    uses: { scoreAccount },
    imports: { valuesFromRow },
  },
  ({ input, uses }) => {
    const stored = valuesFromRow({ row: input });
    const scored = uses.scoreAccount({
      id: input.id,
      name: input.name,
      domain: input.domain,
      values: stored.values,
    });
    return { grade: scored.grade, score: scored.score };
  },
);

// Every enriched row graded with an older model version. Ships disabled and
// stays disabled: after a model change, pilot ten rows through its workflow as
// a batch, read them, then batch the rest (references/run.md). An enabled
// rescore would regrade the whole book the moment a new version deploys, with
// no one reading the first ten.
export const rescoreAccounts = definePlay("rescore_accounts", {
  description:
    "Regrades every enriched company scored with an older version of the fit model, from the values already stored on the row. No enrichment cost.",
  folder: playsFolder,
  model: tamCompanies,
  workflow: rescoreAccountRow,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "date",
            columnSlug: tamCompanies.columns.custom__enriched_at,
            operator: "isNotNull",
          },
          {
            kind: "number",
            columnSlug: tamCompanies.columns.custom__fit_model_version,
            operator: "lowerThan",
            value: fitModel.model_version,
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "45 * * * *" },
});
