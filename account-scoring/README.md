# Account scoring

Score how well each account fits your ICP — judged by an agent against the ICP
written in your context repo, not by point weights in code. Edit the ICP
markdown, and accounts re-score against it as they come due.

## What it does

- Keeps the scoring criteria where the ICP already lives: the context repo
  (`infra/context/icp.md`, an example ICP; if the project already has a context repo, the ICP goes there) — versioned in git, reviewable, and
  shared with every other agent.
- An agent scores every account when it arrives, and re-scores stale ones (last
  scored 3+ months ago) on a weekly sweep: it looks the account up in Cargo's
  business database first, then judges it against the ICP.
- Writes the score, the tier, AND the rationale back to the CRM — a rep can
  always see why an account is tier A.
- Slices accounts into tier segments (A / C ...) that other plays can target.
- An evaluator QAs every score: ungrounded or malformed answers fail the
  rubric.

## How it works

1. **An account arrives** (or a stale account comes due on the weekly sweep).
2. **The scorer agent judges it.** It matches the account in Cargo's business
   database, pulls firmographics, reads the ICP from the context repo, and
   answers with JSON: `{score, tier, rationale}`. ICP disqualifiers cap the
   score at 20.
3. **Write back.** The play writes `cargo_score`, `cargo_tier`,
   `cargo_rationale`, and `cargo_last_updated_at` onto the CRM record.
4. **Sort into tiers.** The next model refresh pulls the score back in, and the
   `tier-a-accounts` / `tier-c-accounts` segments group accounts by it.

Adds 4 resources on top of the base: 1 agent, 1 play (with an embedded
workflow), and 2 segments. Carries an example ICP under `context/`; the agent scores against whatever the workspace context
holds.

| File                            | Resource                        | Role                                            |
| ------------------------------- | ------------------------------- | ----------------------------------------------- |
| `infra/agents/scorer.ts`        | `defineAgent`                   | judges accounts against the ICP, with evaluator |
| `infra/plays/score-accounts.ts` | `definePlay` + `defineWorkflow` | per-account scoring + CRM write-back            |
| `infra/segments/tiers.ts`       | `defineSegment`                 | tier A / C slices over `cargo_tier`             |

## Placeholders (edit before deploy)

1. **The ICP itself** — `infra/context/icp.md`: the criteria ARE
   the prompt; disqualifiers matter as much as fit signals.
2. **Language model** — `infra/agents/scorer.ts`.
3. **Score columns** — `cargo_score`, `cargo_tier`, `cargo_rationale`, and
   `cargo_last_updated_at` must exist as CRM properties, with `cargo_score` and
   `cargo_tier` selected on the accounts model so the segments can filter on
   them.
4. **Tier thresholds** — `infra/segments/tiers.ts`.

## Done when

Add a test account: the run shows the agent's lookups, the CRM record gets a
score with a rationale that cites real evidence and ICP criteria, the evaluator
passes ≥ 0.8, and after the next model refresh the account lands in the right
tier segment.

## Variant: deterministic point-based scoring

If you want zero-LLM scoring (fixed cost, exact reproducibility), swap the
agent call for the native `scoring` node — criteria as `{name, value, score}`
booleans in the workflow. The trade: criteria move from the ICP markdown into
code, and you lose the rationale.

## Extending: skip the CRM roundtrip

Writing the score straight onto the model (instead of going through the CRM)
uses the platform's `modelUpsert` native — `native.modelUpsert({ ... })` in the
workflow. It's in the generated native surface (`.cargo-ai/cargo-types.d.ts`,
written by `cargo-cdk types` on `postinstall`), like the routing engine's
`allocate`; its input is untyped, so confirm the field shape on first run.
