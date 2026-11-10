import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { playsFolder } from "../folders";
import { tamSourceApollo } from "../models/tam-source-apollo";
import { tamUnifyCompany } from "../tools/unify-company";

// Apollo rows carry a LinkedIn URL and a primary domain.
const unifyApolloOrganization = defineWorkflow(
  "tam_unify_apollo_organization",
  {
    input: z.object({
      _id: z.string(),
      linkedin_url: z.string().optional(),
      primary_domain: z.string().optional(),
    }),
    output: z.object({ result: z.string() }),
    uses: { tamUnifyCompany },
    imports: { tamSourceApollo },
  },
  ({ input, uses, model }) => {
    const unified = uses.tamUnifyCompany({
      source: "apollo",
      linkedin_url: input.linkedin_url,
      domain: input.primary_domain,
    });
    model.customColumn({
      modelUuid: tamSourceApollo.uuid,
      // The row's Cargo record id is `_id`. `id` is a column some sources
      // carry (AI Ark's own id), and Sales Navigator rows have none at all.
      id: input._id,
      mappings: [{ columnSlug: "unified_at", value: new Date() }],
    });
    return { result: unified.result };
  },
);

// Ships disabled: enable it after the AI Ark play has finished.
export const unifyApollo = definePlay("tam_unify_apollo", {
  name: "TAM: unify Apollo",
  description:
    "Send every Apollo organization through the unify tool into tam_universe.",
  folder: playsFolder,
  model: tamSourceApollo,
  workflow: unifyApolloOrganization,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "date",
            columnSlug: tamSourceApollo.columns.custom__unified_at,
            operator: "isNull",
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "35 * * * *" },
});
