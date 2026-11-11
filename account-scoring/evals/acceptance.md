# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Model

- `context/icp/scoring.md` was read from the project. With none, the agent stopped and sent the
  operator to win-loss-review's scoring pass, or helped write one by hand marked as a hypothesis.
- `node scripts/account-scoring/sync-model.mjs` passed and `infra/account-scoring/model.ts` was
  regenerated from it, never edited by hand.
- The operator confirmed the attributes and how each is collected.

## Enrichment source

- The workspace was searched for existing enrichment (tools, models with enriched columns,
  crm-enrichment) before the question was asked, and the question named what was found.
- The answer is recorded under `## Decisions`: what is reused, what is built.

## Project

- The agent installed and read `cargo-project` before adapting.
- With tam-building installed, the added columns were moved onto its `tam_companies`, and this
  skill's model copy and AI Ark connector were deleted.
- Every firmographic attribute maps to a column in `settings.ts` and that column is in
  `accountInput`; every provider attribute has its own connector call passed to `assembleProfile`
  under its slug; research attributes are enums in the research schema.
- `enrich_account` writes nothing and contains no agent; every connector call runs with
  `continueOnFailure`.
- `compute_fit` is a script node and nothing else.
- The scoring agent carries the read-only `context` capability, no `webSearch`, no `memory`, no
  model in `uses`, and outputs only the reason.
- `score_account` writes grade, score, breakdown and model version from `compute_fit`, the reason
  from the agent, and `scored_at`, on one write with bare slugs.
- The scoring play filters on `scored_at` (null or stale), uses `changeKinds: ["added"]` and
  `noConcurrency`, and ships disabled; the rescore play ships disabled and calls no provider.
- One segment exists per grade.
- `crmWriteback` is `none` unless the operator named a CRM. When set, the three named properties
  exist, and the CRM node is `updateRecords` with `isFailingOnMultipleMatches`.
- `SCORING_MD=context/icp/scoring.md node --import tsx evals/contract.mjs`,
  `cargo-ai project types`, `cargo-ai project check` and `cargo-ai project plan` pass.

## Guided handoff

- Every substantive message names the current phase and ends with a `Next step` containing one
  concrete decision, what it unlocks, and what stays blocked.
- Nothing was deployed, batched or enabled before its approval.

## Results

- The pilot graded ten rows. Three were read value by value against their evidence, one grade of
  each kind present was checked by hand, and the evaluator results were quoted.
- The pilot reported coverage per attribute and the observed cost per company; the backfill estimate
  came from those actual credits, not from a written price.
- With `crmWriteback` set, one piloted company read back from the CRM carried the row's grade,
  reason and scored-at date.
- Every row carries a grade, a score, a breakdown, a reason, a model version and a stamp, and the
  four segments' counts sum to the graded row count.
- After a model change, the rescore pilot and batch ran with no provider call, and every enriched
  row carries the new `model_version`.
