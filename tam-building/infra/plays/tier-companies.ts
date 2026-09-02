import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { tierAnalyst } from "../agents/tier-analyst";
import { tamCompanies } from "../models/tam-companies";

// One agent call per sourced company, written back onto the row that triggered
// it. The agent judges; this workflow is the only thing that persists, so a
// missing tier is always a failed run and never a silent skip.
const tierCompany = defineWorkflow(
  "tier-tam-company",
  {
    // The columns `aiArk.fetchCompanies` lands. Confirm them against the live
    // model after the first sync (`cargo-ai storage column list`) rather than
    // trusting this list: an extractor that adds a column is harmless, but one
    // that renames `employee_count` leaves the prompt describing an undefined.
    input: z.object({
      id: z.string(),
      name: z.string(),
      domain: z.string(),
      industry: z.string(),
      employee_count: z.number(),
      description: z.string(),
    }),
    output: z.object({ tier: z.string(), rationale: z.string() }),
    uses: { tierAnalyst },
    // `imports` is not optional here. The body is parsed from source, not
    // executed, so a bare closure reference like `tamCompanies` is just a name
    // the parser cannot resolve. Listing it hands the parser the handle, whose
    // `uuid` stays a deferred token the deploy resolves in order.
    imports: { tamCompanies },
  },
  ({ input, uses, model }) => {
    // Agent calls resolve to `{ answer, evaluation? }`; the judgment is on
    // `.answer`. The JSON shape is declared once, on the agent's `output`, so
    // the schema and the write mappings below cannot drift apart.
    const judgment = uses.tierAnalyst({
      prompt: `Tier ${input.name} (${input.domain}) against the ICP and the tiering rubric in the workspace context. Industry: ${input.industry}. Employees: ${input.employee_count}. About: ${input.description}`,
    });

    // Bare slugs, NOT the `custom__` names the read side exposes. The model
    // declares these in `additionalColumns` as `tier`, `tier_rationale`,
    // `tier_evidence_url` and `tiered_at`; `custom__` is only the alias that
    // `storage query` and `storage column list` return. The write path takes
    // the declared slug and nests it under `custom` itself, so a `custom__`
    // prefix here produces `custom.custom__tier`, which is not a declared
    // column. The node still reports "Record upserted" and the value is
    // silently dropped, so the failure looks like a play that ran perfectly
    // over a book with no tiers in it.
    model.customColumn({
      modelUuid: tamCompanies.uuid,
      id: input.id,
      mappings: [
        { columnSlug: "tier", value: judgment.answer.tier },
        { columnSlug: "tier_rationale", value: judgment.answer.rationale },
        {
          columnSlug: "tier_evidence_url",
          value: judgment.answer.evidence_url,
        },
        // The eligibility stamp the play filter reads. It is written on the
        // same node as the tier, so a row can never be marked judged without
        // carrying the judgment.
        { columnSlug: "tiered_at", value: new Date() },
      ],
    });

    return { tier: judgment.answer.tier, rationale: judgment.answer.rationale };
  },
);

// Tiers every company that has never been tiered, and re-tiers anything last
// stamped over six months ago. The filter IS the managed segment: do not
// declare a separate one, and do not repeat these conditions as branches
// inside the workflow.
//
// `changeKinds: ["added"]` is the cost control. Runs are created for rows
// entering the segment, not for the whole book on every tick, so steady state
// is: a sourcing run lands N new companies, the next tick judges those N, and
// every tick after that is a no-op. Drop it and the LLM bill scales with how
// often the cron fires instead of with how many companies you sourced.
//
// Cron, not watch or realtime: `fetchCompanies` is a plain fetch-mode
// extractor, so realtime needs an ingest-mode extractor and watch needs
// `isWatchable` (both fail at deploy with integrationNotCompatible). Hourly
// rather than daily because the model has no schedule of its own: rows land
// whenever someone triggers a sync, and an untiered row sits outside the tier
// segments until the next tick. That gap is up to a day at daily and an hour
// here.
//
// Ships disabled. Enabling is the last yes after the first sourcing run has
// landed and the columns read back the way this file expects, not an input.
export const tierCompanies = definePlay("tier-companies", {
  description:
    "Per-row ICP tiering over AI Ark-sourced companies: the agent judges against the context rubric and the play writes tier, rationale, evidence and stamp back onto the row.",
  model: tamCompanies,
  workflow: tierCompany,
  filter: {
    conjonction: "and",
    groups: [
      {
        // Never tiered, or tiered more than six months ago. The relative
        // window rolls with each run, so a stale account comes back on its own.
        // Note this reads the STAMP, not the tier column: a row whose agent run
        // failed has a null stamp and is retried, while a row legitimately
        // tiered `disqualified` is left alone until it goes stale.
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
