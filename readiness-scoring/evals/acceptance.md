# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Weights

- The inventory query ran on the live Account Events before anything was weighed, and its rows
  were shown to the operator.
- Every key in `signals` matches a `signal_type` or model slug from the inventory, or a feed this
  deploy adds. None was invented.
- The operator approved each weight and half-life, and the reasoning for the strongest one is
  recorded under `## Decisions`.

## Project

- The agent installed and read `cargo-project` before adapting.
- `account_events` is declared once in the project, as `unifyAccountEvents`, and the plan shows it
  adopted, not created.
- The watched accounts model unifies into Unify Accounts, and both feeds watch it on its domain
  column, with a `dailyLeadLimit`.
- `readiness_scores` is a native `defineQuery` model whose query reads `object.account_events`,
  computes the age with `current_timestamp()`, weighs unknown types 0 and deduplicates per account,
  type and day.
- The three crons run in order: Account Events, the score, the play.
- The play filters on `stage = ready_now` only, uses `changeKinds: ["added"]`, posts to one Slack
  channel id, and ships disabled.
- This skill declares no agent and no `defineContext`.
- `node --import tsx evals/contract.mjs`, `cargo-ai project types`, `cargo-ai project check` and
  `cargo-ai project plan` pass.

## Guided handoff

- Every substantive message names the current phase and ends with a `Next step` containing one
  concrete decision, what it unlocks, and what stays blocked.
- The weights phase ends on approving `signals`; the build phase on deploying with the play
  disabled at a stated feed estimate; the pilot on approving the thresholds and enabling the play.
- Nothing was deployed or enabled before its approval.

## Results

- After the first rebuild, `readiness_scores` holds a row for every account with a weighed event
  inside the horizon.
- The thresholds came from the pilot distribution, and the top ten accounts were read by hand.
- The first account to cross the line was posted once, with its score and signals.
- The report gives the distribution, the top accounts, events and credits per feed against the
  estimate, and one recommended next step.

## Repository isolation

- This is one root skill. Supporting Markdown lives under `references/`, and no nested `SKILL.md`
  exists.
- No relative import leaves the skill folder.
- The template contains no credential, deployment command, customer data, or hard-coded price.
