# Acceptance

Walk every line. A checked template without an evidence-backed consumer
adaptation is incomplete.

## ICP and categories

- The workspace context was read for an ICP before anything was researched or
  asked. An existing one was shown and confirmed, not rewritten.
- Industries, company size and countries were proposed from `icp.md` (or
  suggested and labelled), confirmed, and written into all four sources and
  `infra/settings.ts`.
- The categories came from the CRM's company industry field when a CRM is
  connected, otherwise from `icp.md`, and are in `settings.ts`.
  "Not enough information" is still an allowed answer.

## Sources

- Every Sales Navigator URL is under 1,000 accounts and carries `INDUSTRY`,
  `COMPANY_HEADCOUNT` and `REGION`. A larger market was split with
  `extract-sales-navigator-search`. No `identityIds`.
- AI Ark's filter is nested groups, enum values come from the autocompletes,
  and `countCompanies` was run on the deployed filter, lookalike seeds
  included.
- Apollo was deployed with a small first `limit` and read before widening.
- The Exa queries are written one per category and country, in the words a
  buyer would use.
- Every paid source has an explicit `limit` and no schedule.
- The operator approved the filters, the four limits and the maximum spend in
  one approval, with live prices and their lookup time.

## Guided handoff

- Every substantive message names the phase and ends with `Next step`: one
  concrete decision, what it unlocks, what stays blocked.
- In-progress messages that need no decision say `No action needed` and name
  the next checkpoint.

## Project

- `cargo-project` was installed and read before adapting.
- Every resource is declared in the project; no imperative script sources or
  writes anything.
- The connectors are the four sources and LinkedIn. A CRM connector exists only
  under `crm-backed`, and only reads companies with `fetchRecords`.
- This skill declares no `defineContext`.
- `node --import tsx evals/contract.mjs` passes against the adapted resources,
  and `cargo-ai project types`, `check` and `plan` pass.

## Results

- The sources were processed one at a time, in order, each finished before the
  next started.
- Five rows of each source were piloted and read before its play was enabled.
- Every row of `tam_universe` carries a LinkedIn company id, a category, a
  status, and at least one `found_by_*` flag. No company appears twice.
- The report gives the headline (TAM, net new, already in the CRM), the
  per-source table (found, only this source, added in order), the exclusion
  reasons by source, the coverage estimate or why it is too thin, and actual
  credits against the estimate.
- No CRM record was created or updated.

## Repository isolation

- One root skill; supporting Markdown under `references/`; no nested
  `SKILL.md`.
- No relative import leaves the skill folder.
- No credential, deployment command, customer data or hard-coded price in the
  template.
