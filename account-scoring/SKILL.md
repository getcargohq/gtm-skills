---
name: account-scoring
description: 'Keep every account scored and tiered against your written ICP by a deployed agent that re-scores as accounts arrive and as the ICP changes, writing the rationale back to the CRM. Triggers: "keep our accounts scored as they arrive", "re-score everything when the ICP changes", "which accounts should the team work first", "our scoring is a spreadsheet nobody trusts", "why is this account tier A", "stand up account tiering". Cargo CDK, defineAgent, cargo_score, cargo_tier, HubSpot, Salesforce, Attio. Skip when: someone hands you a list and wants it qualified once, which is cargo-gtm''s job, not a deployed scorer''s.'
version: "0.2.0"
compatibility: "Requires @cargo-ai/cli (npm), a Cargo workspace, and a CRM credential (crm-sync). Pulls base-gtm, crm-sync and gtm-knowledge-graph as required siblings."
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
for this cookbook until it is approved.

## The outcome

Every account scored against your ICP, tiered, and written back to the CRM **with the rationale**,
so a rep can always see why an account is tier A. The criteria are not point weights in code: they
are the ICP markdown in your context repo, versioned in git and shared with every other agent. Edit
the ICP and accounts re-score against it as they come due.

**Two failure modes worth knowing before you start.** If the CRM properties do not exist, the run
looks successful and the scores land nowhere, which wastes the whole batch. And `cargo_score` plus
`cargo_tier` must be selected as columns on the accounts model, or the tier segments filter on a
column they cannot see.

## The procedure lives in `deploy-cookbook`

Scaffold or add, adapt, plan, deploy, verify: the same for every cookbook, written once.

```bash
npx skills add getcargohq/cargo-cookbooks/deploy-cookbook   # if it is not already in this session
cargo-ai cdk init my-account --from getcargohq/cargo-cookbooks/account-scoring   # empty directory
cargo-ai manifest add account-scoring --dir .                            # existing CDK project
```

Read `README.md` in this folder before answering anything below. It explains why the design is the
way it is, and that is what makes a good answer possible.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the ones marked
_asked_ genuinely live in the operator's head.

| Input                                                  | Kind      | How it is answered                                                                                                                                                                                                   | Why it matters                                                                                                                                                 |
| ------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `icp` (`gtm-knowledge-graph/context/icp.md`)           | generated | **derived**: If the workspace already has closed-won and closed-lost data, extract the industry, size, geography and stack that separate won from lost accounts and propose the ICP from it rather than asking cold. | The criteria ARE the prompt. There are no point weights in code, so a vague ICP produces vague scores and the disqualifiers are what cap a bad account at 20.  |
| `languageModel` (`account-scoring/agents/scorer.ts`)   | value     | **derived**: whichever LLM connector is already authenticated in the workspace                                                                                                                                       | Scoring quality and per-account cost both live here.                                                                                                           |
| `crmScoreProperties`                                   | manual    | **derived**: read the CRM's account schema through the crm-sync connector and report which of the four are missing                                                                                                   | The play writes all four back. If they do not exist the run looks successful and the scores land nowhere, which is the failure mode that wastes a whole batch. |
| `tierThresholds` (`account-scoring/segments/tiers.ts`) | value     | **asked**                                                                                                                                                                                                            | The agent emits A, B and C but the cookbook ships segments for A and C only. Tier B accounts land in no segment unless you add one.                            |

Checked before moving on, not after the deploy:

- `icp`: the file names at least one disqualifier, not only fit signals
- `crmScoreProperties`: all four exist, and cargo_score plus cargo_tier are selected as columns on the accounts model so the tier segments can filter on them
- `tierThresholds`: every tier the agent can emit is either covered by a segment or deliberately excluded

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the default.

| Variation               | When it is right                                                                                  | How                                                                                                                                                                                               | What it costs                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `deterministic-scoring` | You need fixed cost and exact reproducibility, or an LLM judgement is not acceptable to your team | Swap the agent call for the native `scoring` node, with criteria as {name, value, score} booleans in the workflow (`account-scoring/agents/scorer.ts`, `account-scoring/plays/score-accounts.ts`) | The criteria move out of the ICP markdown and into code, so they stop being reviewable by non-engineers, and you lose the rationale entirely |
| `skip-crm-roundtrip`    | You want the score on the model directly and do not need it visible in the CRM                    | Write with the platform's `native.modelUpsert({...})` in the workflow instead of going through the CRM connector (`account-scoring/plays/score-accounts.ts`)                                      | Reps lose the score and rationale where they actually work. The native's input is untyped, so confirm the field shape on the first run       |
| `no-crm-at-all`         | You have no CRM, or you do not want to hand this cookbook a CRM credential                        | Take `skip-crm-roundtrip`, then drop the `crm-sync` requirement so no CRM connector is registered (`crm-sync/connectors/hubspot.ts`)                                                              | Every other CRM-dependent cookbook you install later will pull `crm-sync` back in anyway                                                     |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The scorer looks the account up before judging it.** (`account-scoring/agents/scorer.ts`) A score guessed from the domain name is unfalsifiable and the rationale cites nothing. The evaluator exists to fail exactly this, and a book scored that way is worse than an unscored one because people trust it.
- **ICP disqualifiers cap the score, they are not just negative weight.** (`account-scoring/agents/scorer.ts`) Without a cap, a disqualified account with many fit signals still scores high and reaches a rep. The disqualifiers are the half of an ICP that actually protects the team's time.
- **`cargo_score` and `cargo_tier` are selected as columns on the accounts model.** (`account-scoring/segments/tiers.ts`) The tier segments filter on a column they cannot see, so they come back empty while everything upstream reports success.
- **Every tier the scorer can emit is either covered by a segment or excluded on purpose.** (`account-scoring/segments/tiers.ts`) The shipped segments cover A and C. The agent also emits B, so tier B accounts land nowhere and quietly disappear from the book.

## Done when

- a test account run shows the agent's lookups in the trace, not a score guessed from the domain name
- the CRM record carries a score with a rationale citing real evidence and named ICP criteria
- the evaluator scores at least 0.8
- after the next model refresh the account appears in the matching tier segment

## What it costs

One LLM call plus up to two Cargo database calls (`matchBusiness`,
`enrichBusinessFirmographics`) per account, on arrival and again on the weekly sweep of accounts
last scored three or more months ago. It scales with accounts in the model times re-scores, so a
TAM built by `tam-building` scores at that size. Score a sample before the book.

## Composes into

`routing-engine` (territories and capacity over the scored book), `rep-cockpit`, `ai-sdr`.
