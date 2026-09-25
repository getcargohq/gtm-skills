# Acceptance

Walk every line. A checked template without an evidence-backed consumer
adaptation is incomplete.

## ICP

- The workspace context was searched for an ICP or scoring file before anything
  was researched or asked. An existing one was shown and confirmed, not
  rewritten.
- When none existed, the website, customer stories and customers' LinkedIn
  pages were read only after their live prices were stated and approved, and
  only customers named on the site were enriched.
- The approved ICP is written to the project's `context/icp.md`. Every
  firmographic line maps to a filter group, and every line no customer supports
  is marked as a hypothesis.

## Sizing

- Every filter group presented is a nested object. No flat top-level key appears
  in any proposed config.
- Every enum-backed value (industry, seniority, department, funding type,
  language) was resolved through the integration's autocompletes, and the
  resolution is recorded. None was written from memory.
- Each disqualifier AI Ark has a field for is a `_not` filter.
- `countCompanies` was run for every candidate filter, including the one finally
  deployed, and the counts are presented as a table the operator can read a
  decision off.
- `limit` is presented against the counted pool, with the live per-record price,
  its lookup time, the CLI version, and the resulting estimate.
- The unified `accounts` model's live config was read. `domain` and `linkedinId`
  are `strong`, or the gap was reported to the operator and left unchanged.

## Guided handoff

- Every substantive agent message names the current phase and ends with a
  `Next step` containing one concrete decision, what it unlocks, and what stays
  blocked.
- Phase one ends by asking the operator to approve the ICP.
- Phase two ends by asking the operator to approve the filter, the `limit`, and
  the maximum spend together. Nothing is deployed or synced before that
  approval.
- The report ends with the two decisions on the net-new accounts (create in the
  CRM, enrich in a dedicated play) and no other offer.
- In-progress messages that need no decision say `No action needed` and name the
  next checkpoint.

## CDK template

- The agent installed and read `cargo-cdk` before sizing or adapting.
- Every resource is declared in the CDK. No imperative script sources or writes
  anything.
- Exactly one company source exists. The example is `aiArk.fetchCompanies` on
  `tam_companies`; a swapped source replaces it rather than sitting beside it.
- The sourced model carries at least one nested filter group, an explicit
  `limit`, `unification: {source: "integration"}`, and **no schedule** (or one
  only under an approved `refresh-cadence` variation whose re-billing cost was
  stated).
- Exactly one CRM companies extract unifies as an account. It is the project's
  existing one when there was one.
- The unified `accounts` model is adopted through `unifyAccounts` and declares
  **no config**.
- The skill deploys no play, agent, tool, or segment.
- This skill declares **no** `defineContext`.
- `node --import tsx evals/contract.mjs` passes against the adapted resources.
- `cargo-ai cdk types`, `cargo-ai cdk check`, and `cargo-ai cdk plan` pass in the
  consumer project.
- The plan was shown and deployment happened only after the sizing approval.

## Results

- Exactly one sourcing run happened. Rows landed at or under `limit`, and the
  shortfall against the counted pool is explained rather than ignored.
- The unified model was refreshed after both source models had synced, and the
  report was read after that refresh finished.
- The `ids` keys used in the report were read from live rows, not assumed.
- `in_crm + net_new = tam_accounts`, and the rows that could not unify are
  counted beside them.
- Three in-CRM and three net-new accounts were spot-checked against the CRM by
  domain.
- Actual credits are reported against the estimate, with the pricing lookup
  time.
- No CRM record was created or updated by this skill.

## Repository isolation

- This is one root skill. Supporting Markdown lives under `references/`, and no
  nested `SKILL.md` exists.
- No relative import leaves the skill folder.
- The template contains no credential, deployment command, customer data, or
  hard-coded price.
