import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { hubspot } from "../../crm-sync/connectors/hubspot";
import { accounts } from "../../base-gtm/models/accounts";
import { accountScorer } from "../agents/scorer";

// Per account: the scorer agent looks the account up, judges it against the
// ICP in the context repo, and returns {score, tier, rationale} as JSON — the
// agent's `answer` is used as an object directly. Score AND rationale land on
// the CRM record, so a rep can always see why an account is tier A.
const scoreAccount = defineWorkflow(
  "score-account",
  {
    input: z.object({ domain: z.string(), name: z.any() }),
    output: z.object({ scored: z.boolean() }),
    uses: { accountScorer, hubspot },
  },
  ({ input, uses }) => {
    const result = uses.accountScorer({
      prompt: `Score the account ${input.name} (${input.domain}).`,
    });

    uses.hubspot.updateRecords({
      objectType: "companies",
      matchingPropertyName: "domain",
      matchingValue: input.domain,
      mappings: [
        { propertyName: "cargo_score", value: result.answer.score },
        { propertyName: "cargo_tier", value: result.answer.tier },
        { propertyName: "cargo_rationale", value: result.answer.rationale },
        {
          propertyName: "cargo_last_updated_at",
          // Workflow bodies are compiled, not executed: `new Date()` is not in
          // scope. Use the runtime template token instead.
          value: new Date(),
        },
      ],
    });

    return { scored: true };
  },
);

// Scores accounts Cargo hasn't stamped yet, and re-scores anything last stamped
// over 3 months ago — the `cargo_last_updated_at` filter keeps re-runs from
// re-scoring fresh records. Edit the ICP markdown and the criteria change with
// it: they're versioned where they belong, in the context repo.
export const scoreAccounts = definePlay("score-accounts", {
  model: accounts,
  workflow: scoreAccount,
  changeKinds: ["added"],
  runCreationRule: "always",
  filter: {
    conjonction: "and",
    groups: [
      {
        // Never scored (no `cargo_last_updated_at` stamp yet), OR last scored
        // more than 3 months ago — the relative "3 months" window rolls with
        // each run, so stale accounts get re-judged.
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: accounts.columns.custom__cargo_last_updated_at,
            operator: "isEmpty",
          },
          {
            kind: "date",
            columnSlug: accounts.columns.custom__cargo_last_updated_at,
            operator: "lowerThan",
            value: "3 months",
          },
        ],
      },
    ],
  },
  schedule: { type: "cron", cron: "0 6 * * 1" },
});
