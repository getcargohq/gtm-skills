# Run

Deploy, pilot, backfill and report, after the rubric is approved. Nothing in
this repository deploys.

## Phase handoffs

Every message names the current phase and ends with `Next step`. A
phase-boundary handoff carries the evidence the operator needs, one concrete
approval request, what approval unlocks, and what stays blocked. An in-progress
update says `No action needed` and names the next checkpoint.

## Deploy, play disabled

1. `node --import tsx evals/contract.mjs` from this skill's folder, against the
   adapted resources.
2. `cargo-ai cdk types`, then `cargo-ai cdk check`, then `cargo-ai cdk plan`
   from the project root. Inspect every resource and action payload.
3. Confirm the plan shows `tam_companies` updated with the four tier columns
   (and no other change to it), the agent, the play with `isEnabled: false`,
   `runCreationRule: noConcurrency` and `changeKinds: ["added"]`, and the four
   segments.
4. Deploy only on the operator's yes. Then confirm the live column names:
   `cargo-ai storage column list --model-uuid <tamCompaniesUuid>`. Every
   column the workflow input names must be there.

Resolve `workspaceUuid` from `cargo-ai whoami` and resource UUIDs from
`cargo.state.json`. Links are
`https://app.getcargo.io/workspaces/<workspaceUuid>/<models|agents|plays|segments>/<uuid>`.

## Pilot

Ten rows through the deployed workflow, as a batch, with the play still
disabled. The play's workflow UUID is in `cargo.state.json`.

```sh
cargo-ai orchestration batch create --workflow-uuid <tierAccountWorkflowUuid> \
  --data '{"kind":"filter","modelUuid":"<tamCompaniesUuid>","limit":10}' \
  --wait-until-finished
```

Then read the ten rows back:

```sql
SELECT name, domain, custom__tier, custom__tier_rationale, custom__tier_evidence_url, custom__tiered_at
FROM <aiArkDataset>.tam_companies
WHERE custom__tiered_at IS NOT NULL
```

Check by hand:

- every row has a tier, a rationale and a stamp; a stamp with no tier is the
  `custom__` write bug
- one A, one C and one disqualified read right against the rubric. A rationale
  that names no rubric line means the context capability is not reading what
  you think it is
- the evaluator results on the batch's runs, with one failing sample quoted if
  there is one

Cost: read actual credits for the batch (`cargo-ai billing usage get-metrics`
for the day, LLM and search lines), divide by ten, and multiply by the
untiered row count. That is the backfill estimate the operator approves.

## Backfill, then enable

`changeKinds: ["added"]` only enrols rows that enter the filter after the play
is on, so the rows already in the model need one batch:

```sh
cargo-ai orchestration batch create --workflow-uuid <tierAccountWorkflowUuid> \
  --data '{"kind":"filter","modelUuid":"<tamCompaniesUuid>","filter":{"conjonction":"and","groups":[{"conjonction":"and","conditions":[{"kind":"date","columnSlug":"custom__tiered_at","operator":"isNull"}]}]}}' \
  --wait-until-finished
```

Then set `isEnabled: true` on the play, plan, and deploy. From then on, the
hourly tick tiers what lands.

## Report

```sql
SELECT COALESCE(custom__tier, 'untiered') AS tier, COUNT(*) AS companies
FROM <aiArkDataset>.tam_companies
GROUP BY 1
ORDER BY companies DESC
```

Report:

- the tier distribution: A, B, C, disqualified, and rows still untiered
- the disqualified share, read as a verdict on tam-building's **filter** rather
  than on the agent
- the evaluator pass rate, with one failing sample quoted
- actual credits against the pilot's estimate
- direct Cargo links to the four segments and the play

End with one recommended `Next step`:

- a large disqualified share: narrow tam-building's filter, where narrowing is
  free, and re-count
- a thin tier A: read five tier B rationales; if they name the same missing
  evidence, the rubric's bar for A is the thing to discuss
- a healthy distribution: contact sourcing on `tier_a_accounts`

## Complete when

- the plan showed the play disabled, and the operator approved the deploy
- the pilot's ten rows were checked by hand, and the backfill was approved at
  the cost the pilot measured
- every row carries a tier, a rationale and a stamp, and the segments' counts
  sum to the tiered row count
- the report gave the distribution, the evaluator pass rate, actual credits,
  and one recommended next step
