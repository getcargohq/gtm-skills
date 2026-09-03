# Run

Adapt the resources after copying this folder into the consumer project. The
first plan deploys the play disabled and sources nothing. Nothing in this
repository deploys.

## Phase handoffs

Every message names the current phase and ends with `Next step`. A
phase-boundary handoff carries the evidence the operator needs, one concrete
approval request, what approval unlocks, and what stays blocked. An in-progress
update says `No action needed` and names the next checkpoint.

After the filter, budget and rubric are approved, deploy with the play at
`isEnabled: false` and no sync triggered. Resolve `workspaceUuid` from
`cargo-ai whoami` (`workspace.uuid`) and resource UUIDs from `cargo.state.json`
or the matching get/list command. Send all four links:

- Model: `https://app.getcargo.io/workspaces/<workspaceUuid>/models/<modelUuid>`
- Agent: `https://app.getcargo.io/workspaces/<workspaceUuid>/agents/<agentUuid>`
- Play: `https://app.getcargo.io/workspaces/<workspaceUuid>/plays/<playUuid>`
- Context: the repository directory, so the operator can read the rubric the
  agent will read

Do not ask for run approval when a link is missing or does not resolve. The same
message carries the counted pool, the `limit` that will actually be sourced, the
live per-record price with its lookup time, the resulting estimate, and the
per-company tiering cost. Its `Next step` asks the operator to approve the first
sourcing run at that stated maximum.

## The boundary between the agent and the play

`tam-tier-analyst` is the judgment. It reads `icp.md` and `tiering-rubric.md`
through the read-only `context` capability, judges on the sourced firmographics,
and uses `webSearch` only to settle a doubt that would change the tier. It
returns `{tier, rationale, evidence_url}` and carries **no model in `uses`**.

`tier-companies` is the orchestration and the only write. One agent node, then
one `modelCustomColumn` node writing `tier`, `tier_rationale`,
`tier_evidence_url` and `tiered_at` back onto the row that triggered the run.

This is a compiled-node contract, not a naming convention:
`node --import tsx evals/contract.mjs` asserts it against the compiled registry
and must pass before the plan is reviewed.

Two things that fail silently and are worth checking by hand as well:

- **Bare column slugs on the write.** `custom__` is the read-side alias. The
  write path nests the declared slug under `custom` itself, so `custom__tier`
  becomes `custom.custom__tier`, the node reports "Record upserted", and the
  value is dropped.
- **The extractor's real column names.** Confirm them with
  `cargo-ai storage column list` after the first sync. A renamed column leaves
  the prompt interpolating an undefined, and the agent confidently tiers a
  company it was told nothing about.

## Sourcing, once

Sourcing is a deliberate spend, which is why the model carries no schedule.
Trigger one sync from the model's UI or with the CLI, and watch the row count
against `limit`. Rows landing well under `limit` means the pool was smaller than
counted, or a filter value matched nothing: check the enum-backed values before
widening anything.

Then enable the play **and execute it once**. It will not pick up rows that
landed while it was disabled: `changeKinds: ["added"]` only enrols rows entering
the segment after the play is on. Confirm the extractor's column names against
the live model before that run; a renamed column leaves the prompt interpolating
an undefined.

## Verification

1. `node --import tsx evals/contract.mjs` after adapting the resources.
2. `cargo-ai cdk types`, then `cargo-ai cdk check`, then `cargo-ai cdk plan`.
   Inspect every resource and action payload.
3. Confirm the plan shows the model with **no schedule**, the play with
   `isEnabled: false`, `runCreationRule: noConcurrency`, and
   `changeKinds: ["added"]`.
4. Confirm the play's trigger filters on `custom__tiered_at` (null or stale) and
   not on the tier column.
5. Deploy only under the phase-one authorization.
6. Send the UI links, the counted pool, the estimate, and the pricing lookup
   time. Stop for approval.
7. Sync, enable, and monitor. Spot-check three tiered rows against the rubric by
   hand: one A, one C, one disqualified. A rationale that does not name a rubric
   line is the signal that the context capability is not reading what you think
   it is.

## Post-run report

- rows landed against `limit`, and against the counted pool
- tier distribution: A, B, C, disqualified, and rows still untiered
- the disqualified share, read as a verdict on the **filter** rather than on the
  agent
- the evaluator pass rate, with one failing sample quoted
- estimated credits, actual credits, and the variance, with the pricing lookup
  time
- direct Cargo links for the model, the agent, and the play

End with one recommended `Next step`:

- a large disqualified share means narrowing the filter, where narrowing is free,
  then re-counting
- a small one with rows to spare means widening `limit` and re-syncing
- a healthy distribution means moving to contact sourcing on `tam-tier-a`

Do not end the report with an open-ended offer to help.

## Complete when

- the plan showed the model unscheduled and the play disabled before anything
  was sourced
- the operator approved the filter, the budget and the rubric, and then approved
  the run at a stated maximum
- every landed row carries a tier, a rationale, and a stamp
- the tier segments resolve (`tam-tier-a`, `tam-tier-b`, `tam-tier-c`,
  `tam-disqualified`) and their counts reconcile with the tiered row count
- the report includes the tier distribution, the evaluator pass rate, the actual
  variance against estimate, and one recommended next step
- no credential, customer data, or deploy command was written into the copied
  template
