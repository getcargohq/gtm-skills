import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { playsFolder } from "../folders";
import { tamCompanies } from "../models/tam-companies";
import { rescoreAfter } from "../settings";
import { accountInput, enrichAccount } from "../tools/enrich-account";
import { scoreAccount } from "../tools/score-account";

// The two steps, in order, for every company that arrives or goes stale:
// enrich it until it holds every value the fit model needs, store those
// values on the row, then score it. Two writes, on purpose: the values are
// data other agents and reps use, written as soon as they exist; the grade,
// its reason and the eligibility stamp are written together by score_account.
const scoreAccountRow = defineWorkflow(
  "score_account_row",
  {
    input: accountInput,
    output: z.object({ grade: z.string(), score: z.number() }),
    uses: { enrichAccount, scoreAccount },
    imports: { tamCompanies },
  },
  ({ input, uses, model }) => {
    // The fields the enrichment reads: identity, plus one per firmographic
    // attribute (settings.ts `firmographicColumns`).
    const profile = uses.enrichAccount({
      id: input.id,
      name: input.name,
      domain: input.domain,
      linkedin_url: input.linkedin_url,
      employee_count: input.employee_count,
    });

    model.customColumn({
      modelUuid: tamCompanies.uuid,
      id: input.id,
      mappings: profile.mappings,
    });

    const scored = uses.scoreAccount({
      id: input.id,
      name: input.name,
      domain: input.domain,
      values: profile.values,
    });

    return { grade: scored.grade, score: scored.score };
  },
);

// Enriches and grades every company never scored, and refreshes anything
// scored longer ago than `rescoreAfter` (settings.ts, six months by default).
// The filter reads the STAMP, not the grade: a failed run leaves a null stamp
// and is retried, while a No Fit stays put until it goes stale.
//
// `changeKinds: ["added"]` is the cost control: runs are created for rows
// entering the filter, not for the whole book on every tick. Cron, not watch
// or realtime: `fetchCompanies` is a plain fetch extractor. Ships disabled:
// pilot ten rows first (references/run.md), then enable and backfill, since
// `added` does not enrol the rows that were already there.
export const scoreAccounts = definePlay("score_accounts", {
  description:
    "Enriches each new or stale company for the fit model, stores the values on the row, and grades it Strong / Moderate / Weak / No Fit with a computed score and an explained reason.",
  folder: playsFolder,
  model: tamCompanies,
  workflow: scoreAccountRow,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "or",
        conditions: [
          {
            kind: "date",
            columnSlug: tamCompanies.columns.custom__scored_at,
            operator: "isNull",
          },
          {
            kind: "date",
            columnSlug: tamCompanies.columns.custom__scored_at,
            operator: "lowerThan",
            value: rescoreAfter,
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "15 * * * *" },
});
