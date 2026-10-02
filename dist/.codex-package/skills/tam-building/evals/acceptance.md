# Acceptance

Walk every line. A checked template without an evidence-backed consumer
adaptation is incomplete.

## Sizing

- The ICP was read from the workspace context repository before the operator was
  asked for it. It was only asked for when nothing was written down anywhere,
  and the answer was written to the project's `context/icp.md`.
- Every filter group presented is a nested object. No flat top-level key appears
  in any proposed config.
- Every enum-backed value (industry, seniority, department, funding type,
  language) was resolved through the integration's autocompletes, and the
  resolution is recorded. None was written from memory.
- `countCompanies` was run for every candidate filter, including the one finally
  deployed, and the counts are presented as a table the operator can read a
  decision off.
- `limit` is presented against the counted pool, with the live per-record price,
  its lookup time, the CLI version, and the resulting estimate.
- No paid call was made during sizing. `countCompanies` is free; nothing else
  ran.
- The tier rubric was proposed in the ICP's own language, corrected by the
  operator, and written to the project's `context/tiering-rubric.md`. It is not
  in the agent's system prompt.
- Disqualifiers are stated as disqualifiers, not as low scores.

## Guided handoff

- Every substantive agent message names the current phase and ends with a
  `Next step` containing one concrete decision, what it unlocks, and what stays
  blocked.
- Phase one ends by asking the operator to approve the filter, the `limit`, and
  the rubric together, and to authorize deploying with the play disabled.
- Phase two occurs only after that approval. The model, agent and play are
  deployed, the play disabled and no sync triggered, with working direct Cargo
  UI links for each.
- Phase two ends by asking the operator to approve the first sourcing run at a
  stated maximum. Nothing is sourced or enabled before that approval.
- Phase three syncs once with the play still disabled, confirms column names,
  then enables the play and executes it once so landed rows are enrolled. It
  reports rows landed against `limit`, the tier distribution, the disqualified
  share read as a verdict on the filter, the evaluator pass rate with a failing
  sample, actual credits against estimate, and one recommended next step.
- In-progress messages that need no decision say `No action needed` and name the
  next checkpoint.

## CDK template

- The agent installed and read `cargo-cdk` before sizing or adapting.
- Every resource is declared in the CDK. No imperative script sources, tiers, or
  writes anything.
- Exactly one company source exists. The example is `aiArk.fetchCompanies` on
  `tam_companies`; a swapped source replaces it rather than sitting beside it.
- The model config carries at least one nested filter group and an explicit
  `limit`.
- The model carries **no schedule**, or carries one only under an explicitly
  approved `refresh-cadence` variation whose re-billing cost was stated.
- The model declares `tier`, `tier_rationale`, `tier_evidence_url` and
  `tiered_at` as custom columns.
- `tam-tier-analyst` carries the read-only `context` capability and `webSearch`,
  declares a `jsonSchema` output whose `tier` property is an enum, and carries an
  evaluator rubric with a threshold. It does **not** carry `memory`.
- `tam-tier-analyst` has **no model in `uses`** and no connector action that
  writes.
- This skill declares **no** `defineContext`. The example markdown under
  `infra/context/` is copied into the project's knowledge layer.
- The play is filed under `tam-building-plays`.
- The play's workflow contains exactly one agent node, and it is the first node
  after `start`.
- The play contains no connector node: sourcing is the extractor, never a search
  repeated inside the play.
- The play contains exactly one write, a `modelCustomColumn` on the model it runs
  on, immediately consuming the agent's judgment.
- Every write mapping uses the **bare** declared slug. No mapping carries the
  `custom__` read-side prefix.
- `tier`, `tier_rationale`, `tier_evidence_url` and `tiered_at` are written on
  that same node, so a row cannot be stamped without carrying its judgment.
- The play trigger filters on `custom__tiered_at` being null or older than the
  refresh window, and contains **no** condition on the tier column.
- The play ships `isEnabled: false`, `runCreationRule: noConcurrency`,
  `changeKinds: ["added"]`, and a cron schedule.
- The segments filter on the tier column only, and their values match the
  agent's tier enum and the rubric's tier names exactly.
- No segment restates the play's own trigger filter.
- The workflow input matches the extractor's real column names, confirmed with
  `cargo-ai storage column list` against the live model rather than assumed.
- `node --import tsx evals/contract.mjs` passes against the adapted resources.
- `cargo-ai cdk types`, `cargo-ai cdk check`, and `cargo-ai cdk plan` pass in the
  consumer project.
- The plan was shown and deployment happened only after phase-one approval.

## Results

- Rows landed at or under `limit`, and the shortfall against the counted pool is
  explained rather than ignored.
- Every landed row carries a tier the rubric defines, a rationale naming the
  deciding lines, and a stamp.
- No row carries a stamp with an empty tier, and none carries a tier with an
  empty stamp.
- Three rows were spot-checked by hand against the rubric: one A, one C, one
  disqualified. Each rationale names a rubric line.
- Editing `tiering-rubric.md` changed a subsequent tier with no deploy, and this
  was demonstrated rather than asserted.
- The tier segment counts reconcile with the tiered row count.

## Repository isolation

- This is one root skill. Supporting Markdown lives under `references/`, and no
  nested `SKILL.md` exists.
- No relative import leaves the skill folder.
- The template contains no credential, deployment command, customer data, or
  hard-coded price.
