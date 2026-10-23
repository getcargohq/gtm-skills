# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `lookalike-rubric.md` is in the project's context repo, approved by the operator, and names the
  markets, at least one hard reject, a blocklist, the functions sold to, and persona tiers by title.
- The seed rows are approved by the operator, and rows without a trigger, a signer or a shape at
  purchase were flagged before the pilot.
- The AI Ark and email verification connections exist in the workspace.
- `node --import tsx evals/contract.mjs` passes against the adapted graph.
- `cargo-ai project types && cargo-ai project check && cargo-ai project plan` pass in the consumer
  project, and the plan shows the play disabled.

## The pilot

- One customer ran as a batch with the play disabled.
- Every company the researcher returned has a row in `lookalike_prospects` with a final verdict.
- No row is a customer, a blocklisted domain, or outside the rubric's regions.
- A `drafted` row has a sourced, dated urgency, a `valid` email, and an opener whose two sentences
  are true of the company and name no customer.
- A stopped row reads right against the rubric line that stopped it.
- A second run of the same customer paid for no company already in the ledger.
- The observed credits per customer, times the number of seeds, was quoted as the monthly cost and
  approved before the play was enabled.

## Isolation

- This is one root skill. Its supporting Markdown lives under `references/` and `context/`, and no
  nested `SKILL.md` exists.
- No agent holds a model or a native action; the play is the only writer, and nothing sends email.
- No credential, deployment command, or customer data is in this repository.
- No relative import leaves the skill.
