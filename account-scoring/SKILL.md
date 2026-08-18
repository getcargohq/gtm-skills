---
name: account-scoring
description: 'Keep every account scored and tiered against your written ICP by a deployed agent that re-scores as accounts arrive and as the ICP changes, writing the rationale back to the CRM. Triggers: "keep our accounts scored as they arrive", "re-score everything when the ICP changes", "which accounts should the team work first", "our scoring is a spreadsheet nobody trusts", "why is this account tier A", "stand up account tiering". Cargo CDK, defineAgent, cargo_score, cargo_tier, HubSpot, Salesforce, Attio. Skip when: someone hands you a list and wants it qualified once, which is cargo-gtm''s job, not a deployed scorer''s.'
version: "0.1.0"
compatibility: Requires @cargo-ai/cli (npm), a Cargo workspace, and a CRM credential (crm-sync). Pulls base-gtm, crm-sync and gtm-knowledge-graph as required siblings.
homepage: https://github.com/getcargohq/cargo-cookbooks/tree/main/account-scoring
metadata:
  author: getcargo
  openclaw:
    requires:
      bins:
        - cargo-ai
    install:
      - kind: node
        package: "@cargo-ai/cli@latest"
        bins:
          - cargo-ai
    homepage: https://github.com/getcargohq/cargo-cookbooks
---

# Account scoring

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this cookbook until `cookbook.json` says `approved`.

## The outcome

Every account scored against your ICP, tiered, and written back to the CRM **with the rationale**,
so a rep can always see why an account is tier A. The criteria are not point weights in code: they
are the ICP markdown in your context repo, versioned in git and shared with every other agent. Edit
the ICP and accounts re-score against it as they come due.

## The procedure lives in `deploy-cookbook`

```bash
npx skills add getcargohq/cargo-cookbooks/deploy-cookbook   # if it is not already in this session
cargo-ai cdk init my-scoring --from getcargohq/cargo-cookbooks/account-scoring
```

That pulls `base-gtm`, `crm-sync` and `gtm-knowledge-graph` with it. Read `README.md` in this
folder first, including the deterministic variant at the bottom if you want zero-LLM scoring.

## What you will be asked

Four inputs, in `cookbook.json`. The first one is the whole cookbook.

| Input                | Derived, or asked                                                                  | Why it matters                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `icp`                | **asked**, or proposed from closed-won vs closed-lost data if the workspace has it | The criteria ARE the prompt. Name the disqualifiers, not only the fit signals: they are what caps a bad account at 20. |
| `languageModel`      | derived from the authenticated LLM connector                                       | Scoring quality and per-account cost both live here.                                                                   |
| `crmScoreProperties` | **checked, not written**                                                           | `cargo_score`, `cargo_tier`, `cargo_rationale`, `cargo_last_updated_at` must exist on the CRM account object first.    |
| `tierThresholds`     | asked                                                                              | The agent emits A, B and C. The shipped segments cover A and C only.                                                   |

**Two failure modes worth knowing before you start.** If the CRM properties do not exist, the run
looks successful and the scores land nowhere, which wastes the whole batch. And `cargo_score` plus
`cargo_tier` must be selected as columns on the accounts model, or the tier segments filter on a
column they cannot see.

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers
them rather than waiting to be asked:

| Variation               | When it is right                                                                                  | What it costs                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `deterministic-scoring` | You need fixed cost and exact reproducibility, or an LLM judgement is not acceptable to your team | The criteria move out of the ICP markdown and into code, so they stop being reviewable by non-engineers, and you lose the rationale entirely |
| `skip-crm-roundtrip`    | You want the score on the model directly and do not need it visible in the CRM                    | Reps lose the score and rationale where they actually work. The native's input is untyped, so confirm the field shape on the first run       |
| `no-crm-at-all`         | You have no CRM, or you do not want to hand this cookbook a CRM credential                        | Every other CRM-dependent cookbook you install later will pull `crm-sync` back in anyway                                                     |

## What should not change

- **The scorer looks the account up before judging it.** A score guessed from the domain name is unfalsifiable and the rationale cites nothing. The evaluator exists to fail exactly this, and a book scored that way is worse than an unscored one because people trust it.
- **ICP disqualifiers cap the score, they are not just negative weight.** Without a cap, a disqualified account with many fit signals still scores high and reaches a rep. The disqualifiers are the half of an ICP that actually protects the team's time.
- **`cargo_score` and `cargo_tier` are selected as columns on the accounts model.** The tier segments filter on a column they cannot see, so they come back empty while everything upstream reports success.
- **Every tier the scorer can emit is either covered by a segment or excluded on purpose.** The shipped segments cover A and C. The agent also emits B, so tier B accounts land nowhere and quietly disappear from the book.

Ask for one of these anyway and the agent will tell you what breaks, then do it
if you still want it, and record why in `cookbook.json` `decisions`.

## Done when

- A test account run shows the agent's lookups in the trace, not a score guessed from the domain.
- The CRM record carries a score with a rationale citing real evidence and named ICP criteria.
- The evaluator scores at least 0.8.
- After the next model refresh the account appears in the matching tier segment.

## What it costs

One LLM call plus up to two Cargo database calls (`matchBusiness`,
`enrichBusinessFirmographics`) per account, on arrival and again on the weekly sweep of accounts
last scored three or more months ago. It scales with accounts in the model times re-scores, so a
TAM built by `tam-building` scores at that size. Score a sample before the book.

## Composes into

`routing-engine` (territories and capacity over the scored book), `rep-cockpit`, `ai-sdr`.
