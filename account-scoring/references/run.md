# Run

Deploy, pilot, backfill, report, and rescore after a model change. Nothing in this repository
deploys.

## Phase handoffs

Every message names the current phase and ends with `Next step`. A phase-boundary handoff carries the
evidence the operator needs, one concrete approval request, what approval unlocks, and what stays
blocked. An in-progress update says `No action needed` and names the next checkpoint.

## Deploy, plays disabled

1. `node scripts/account-scoring/sync-model.mjs` from the project root, then
   `SCORING_MD=context/icp/scoring.md node --import tsx evals/contract.mjs` from this skill's
   folder, against the adapted resources.
2. `cargo-ai project types`, then `cargo-ai project check`, then `cargo-ai project plan` from the
   project root. Inspect every resource and action payload.
3. Confirm the plan shows `tam_companies` updated with the added columns (and no other change to
   it), the three tools, the scoring agent, both plays with `isEnabled: false`, and the four
   segments. With `crmWriteback` set, it also shows the `crm` connector bound and an
   `updateRecords` node in `score_account`; with `none`, neither.
4. Deploy only on the operator's yes. Then confirm the live column names:
   `cargo-ai storage column list --model-uuid <tamCompaniesUuid>`.

Resolve `workspaceUuid` from `cargo-ai whoami` and resource UUIDs from `cargo.state.json`. Links are
`https://app.getcargo.io/workspaces/<workspaceUuid>/<models|agents|plays|segments|tools>/<uuid>`.

## Pilot

Ten rows through the scoring play's workflow, as a batch, with the play still disabled. The
workflow UUID is in `cargo.state.json`.

```sh
cargo-ai orchestration batch create --workflow-uuid <scoreAccountRowWorkflowUuid> \
  --data '{"kind":"filter","modelUuid":"<tamCompaniesUuid>","filter":{"conjonction":"and","groups":[{"conjonction":"and","conditions":[{"kind":"date","columnSlug":"custom__scored_at","operator":"isNull"}]}]},"limit":10}' \
  --wait-until-finished
```

Then read the ten rows back. Storage SQL lags the write by about a minute (the result says
`"isRefreshing": true`), so an empty result straight after the batch is the lag, not a failed
write: the write nodes of a run report "Record upserted" when they landed.

```sql
SELECT name, domain, custom__fit_grade, custom__fit_score, custom__fit_breakdown,
       custom__fit_reason, custom__fit_model_version, custom__scored_at
FROM <aiArkDataset>.tam_companies
WHERE custom__scored_at IS NOT NULL
```

Check by hand:

- every row has a grade, a score, a breakdown, a reason and a stamp; a stamp with no grade is the
  `custom__` write bug
- three rows, value by value: each `fit_<attribute>` against its `fit_<attribute>_evidence`. A
  research value whose page does not say it is a research question to tighten in `scoring.md`
- one grade of each kind present, against the breakdown: the points add up to the score, and a No
  Fit names the filter that fired
- coverage per attribute: how many of the ten came back unknown. An attribute unknown on most rows
  is a source problem (wrong keywords, a provider without coverage), not a market fact
- the evaluator results on the batch's runs, with one failing sample quoted if there is one
- with `crmWriteback` set, one piloted company that the CRM holds, read back from the CRM, carries
  the same grade, reason and scored-at date as its row. The CRM node runs with `continueOnFailure`,
  so a miss, a misspelled field or a lapsed connection all end the run green; this read is what
  tells them apart

```sh
cargo-ai orchestration run get <runUuid>
```

Cost: sum `creditsUsedCount` over the executions of the batch's runs
(`cargo-ai orchestration run list --workflow-uuid <uuid> --batch-uuid <uuid>`), divide by ten, and
multiply by the ungraded row count. That is the backfill estimate the operator approves. Most of it
is step 1: read which node costs most before choosing a variation.

## Backfill, then enable

`changeKinds: ["added"]` only enrols rows that enter the filter after the play is on, so the rows
already in the model need one batch:

```sh
cargo-ai orchestration batch create --workflow-uuid <scoreAccountRowWorkflowUuid> \
  --data '{"kind":"filter","modelUuid":"<tamCompaniesUuid>","filter":{"conjonction":"and","groups":[{"conjonction":"and","conditions":[{"kind":"date","columnSlug":"custom__scored_at","operator":"isNull"}]}]}}' \
  --wait-until-finished
```

Then set `isEnabled: true` on the scoring play, plan, and deploy. From then on, the hourly tick
grades what lands. A segment's stored `recordsCount` is computed when the model syncs, so right
after a pilot or a backfill the four segments show the counts from before it; read the live split
with the SQL below.

## Report

```sql
SELECT COALESCE(custom__fit_grade, 'ungraded') AS grade, COUNT(*) AS companies
FROM <aiArkDataset>.tam_companies
GROUP BY 1
ORDER BY companies DESC
```

Report:

- the grade distribution: Strong, Moderate, Weak, No Fit, and rows still ungraded
- the No Fit share, read as a verdict on tam-building's **filter** rather than on the model
- coverage per attribute across the book
- the evaluator pass rate, with one failing sample quoted
- actual credits against the pilot's estimate
- direct Cargo links to the four segments and the plays

End with one recommended `Next step`:

- a large No Fit share: narrow tam-building's filter, where narrowing is free, and re-count
- one attribute unknown on most companies: fix its source before trusting the Moderate band, since
  every unknown scores half its weight
- a healthy distribution: contact sourcing on `strong_fit_accounts`

## Rescore after a model change

Every rebuild of `scoring.md` (win-loss-review hands off here) raises `model_version`.

1. `node scripts/account-scoring/sync-model.mjs`, the contract, `cargo-ai project plan`. The plan
   shows the new model in the script nodes, any new column, and the rescore play's filter at the
   new version. Deploy on a yes.
2. **Same attributes.** Pilot ten rows through the rescore play's workflow, read them as above,
   then batch the rest. No provider call, no research: only the scoring agent per company.

```sh
cargo-ai orchestration batch create --workflow-uuid <rescoreAccountRowWorkflowUuid> \
  --data '{"kind":"filter","modelUuid":"<tamCompaniesUuid>","filter":{"conjonction":"and","groups":[{"conjonction":"and","conditions":[{"kind":"number","columnSlug":"custom__fit_model_version","operator":"lowerThan","value":<newVersion>},{"kind":"date","columnSlug":"custom__enriched_at","operator":"isNotNull"}]}]},"limit":10}' \
  --wait-until-finished
```

3. **A new attribute.** Wire it in step 1 if it is a provider attribute (the contract says which),
   then run the scoring play's workflow over the book: pilot ten rows, price it, batch the rest.
   Until then the new attribute is unknown everywhere and scores half its weight.

## Complete when

- the plan showed both plays disabled, and the operator approved the deploy
- the pilot's ten rows were checked by hand, coverage and cost were reported, and the backfill was
  approved at the cost the pilot measured
- every row carries a grade, a score, a breakdown, a reason, a model version and a stamp, and the
  segments' counts sum to the graded row count
- the report gave the distribution, coverage, the evaluator pass rate, actual credits, and one
  recommended next step
