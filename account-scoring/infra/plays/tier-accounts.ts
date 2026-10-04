import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { tierAnalyst } from "../agents/tier-analyst";
import { playsFolder } from "../folders";
import { tamCompanies } from "../models/tam-companies";

// One agent call per company, written back onto the row that triggered it.
// The agent judges; this workflow is the only thing that persists, so a
// missing tier is always a failed run and never a silent skip.
const tierAccount = defineWorkflow(
  "tier_account",
  {
    // The columns `aiArk.fetchCompanies` lands, confirmed against a live
    // `tam_companies` on 2026-10-03. On a swapped source, check them with
    // `cargo-ai storage column list` first: a renamed column leaves the prompt
    // describing an undefined, and the agent tiers a company it was told
    // nothing about.
    input: z.object({
      id: z.string(),
      name: z.string(),
      domain: z.string(),
      industry: z.string(),
      employee_count: z.number(),
      country: z.string(),
      description: z.string(),
    }),
    output: z.object({ tier: z.string(), rationale: z.string() }),
    uses: { tierAnalyst },
    // `imports` is not optional here. The body is parsed from source, not
    // executed, so a bare closure reference like `tamCompanies` is a name the
    // parser cannot resolve. Listing it hands the parser the handle, whose
    // `uuid` stays a deferred token the deploy resolves in order.
    imports: { tamCompanies },
  },
  ({ input, uses, model }) => {
    // Agent calls resolve to `{ answer, evaluation? }`; the judgment is on
    // `.answer`. The JSON shape is declared once, on the agent's `output`, so
    // the schema and the write below cannot drift apart.
    const judgment = uses.tierAnalyst({
      prompt: `Tier ${input.name} (${input.domain}) against the ICP and the tiering rubric in the workspace context. Industry: ${input.industry}. Employees: ${input.employee_count}. Country: ${input.country}. About: ${input.description}`,
    });

    // Bare slugs, NOT the `custom__` names the read side exposes. The write
    // path nests the declared slug under `custom` itself, so `custom__tier`
    // here becomes `custom.custom__tier`: the node still reports "Record
    // upserted" and the value is dropped, which looks like a play that ran
    // perfectly over a book with no tiers in it.
    model.customColumn({
      modelUuid: tamCompanies.uuid,
      id: input.id,
      mappings: [
        { columnSlug: "tier", value: judgment.answer.tier },
        { columnSlug: "tier_reason", value: judgment.answer.rationale },
        {
          columnSlug: "tier_evidence_url",
          value: judgment.answer.evidence_url,
        },
        // The eligibility stamp the play filter reads, written on the same
        // node as the tier, so a row is never marked judged without carrying
        // the judgment.
        { columnSlug: "tiered_at", value: new Date() },
      ],
    });

    return { tier: judgment.answer.tier, rationale: judgment.answer.rationale };
  },
);

// Tiers every company never tiered, and re-tiers anything stamped over six
// months ago. The filter IS the eligibility: no separate segment restates it,
// and the workflow does not branch on it again.
//
// `changeKinds: ["added"]` is the cost control. Runs are created for rows
// entering the filter, not for the whole book on every tick, so steady state
// is: a sync lands N new companies, the next tick judges those N, and every
// tick after is a no-op. Drop it and the LLM bill scales with how often the
// cron fires instead of with how many companies arrived.
//
// Cron, not watch or realtime: `fetchCompanies` is a plain fetch extractor, so
// realtime needs an ingest-mode extractor and watch needs `isWatchable` (both
// fail at deploy with integrationNotCompatible). Hourly, because the model has
// no schedule of its own: rows land whenever someone syncs, and an untiered
// row sits outside the tier segments until the next tick.
//
// Ships disabled. Pilot a sample through the workflow first
// (references/run.md), then enable and execute once: `added` does not backfill
// the rows that were already there while the play was off.
export const tierAccounts = definePlay("tier_accounts", {
  description:
    "Per-company ICP tiering over the TAM: the agent judges against the context rubric and the play writes tier, rationale, evidence and stamp back onto the row.",
  folder: playsFolder,
  model: tamCompanies,
  workflow: tierAccount,
  filter: {
    conjonction: "and",
    groups: [
      {
        // Never tiered, or tiered more than six months ago. This reads the
        // STAMP, not the tier: a failed run leaves a null stamp and is retried,
        // while a row tiered `disqualified` stays put until it goes stale.
        conjonction: "or",
        conditions: [
          {
            kind: "date",
            columnSlug: tamCompanies.columns.custom__tiered_at,
            operator: "isNull",
          },
          {
            kind: "date",
            columnSlug: tamCompanies.columns.custom__tiered_at,
            operator: "lowerThan",
            value: "6 months",
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
