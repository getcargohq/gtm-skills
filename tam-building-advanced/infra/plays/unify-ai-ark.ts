import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { playsFolder } from "../folders";
import { tamSourceAiArk } from "../models/tam-source-ai-ark";
import { tamUnifyCompany } from "../tools/unify-company";

// AI Ark rows carry a LinkedIn URL and a domain. The URL goes first: the
// unify tool recognises a company the TAM already holds by it, for free.
const unifyAiArkCompany = defineWorkflow(
  "tam_unify_ai_ark_company",
  {
    input: z.object({
      _id: z.string(),
      linkedin_url: z.string().optional(),
      domain: z.string().optional(),
    }),
    output: z.object({ result: z.string() }),
    uses: { tamUnifyCompany },
    imports: { tamSourceAiArk },
  },
  ({ input, uses, model }) => {
    const unified = uses.tamUnifyCompany({
      source: "ai_ark",
      linkedin_url: input.linkedin_url,
      domain: input.domain,
    });
    model.customColumn({
      modelUuid: tamSourceAiArk.uuid,
      // The row's Cargo record id is `_id`. `id` is a column some sources
      // carry (AI Ark's own id), and Sales Navigator rows have none at all.
      id: input._id,
      mappings: [{ columnSlug: "unified_at", value: new Date() }],
    });
    return { result: unified.result };
  },
);

// Ships disabled: enable it after the Sales Navigator play has finished.
export const unifyAiArk = definePlay("tam_unify_ai_ark", {
  name: "TAM: unify AI Ark",
  description:
    "Send every AI Ark company through the unify tool into tam_universe.",
  folder: playsFolder,
  model: tamSourceAiArk,
  workflow: unifyAiArkCompany,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "date",
            columnSlug: tamSourceAiArk.columns.custom__unified_at,
            operator: "isNull",
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "20 * * * *" },
});
