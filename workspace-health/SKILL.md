---
name: workspace-health
description: 'Know the morning something breaks: a deployed agent reads the last 24 hours of the workspace against the week before and posts to Slack only what is wrong and new: failing runs grouped by cause, a lost connector, a play that stopped, runs that succeed and write nothing, a spend spike, a stuck batch. Mondays it posts the week: still open, cleared, all clear. Triggers: "tell me what is broken in the workspace", "watch my workspace every morning", "alert me when a play stops running", "is anything failing in Cargo", "catch silent failures before a customer does", "tell me in slack every morning if a play broke". Cargo project, defineAgent, harness claudeCode, orchestration SQL, billing metrics, Slack. Skip when: one run already failed and you want to know why, which is cargo-diagnostics in the Cargo pack; or you want initiatives graded against what ran, which is weekly-planning.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.67 or later (harness agents rooted at the package.json that declares @cargo-ai/cdk). Also needs a Cargo workspace, an authenticated Anthropic connector, a Slack connector with the Cargo app invited to the findings channel, and a Cargo project repository the harness clones for its CLI."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/workspace-health
metadata:
  author: getcargo
  source: cookbook
  personas:
    - revops
    - gtm-engineering
  openclaw:
    requires:
      bins:
        - cargo-ai
    install:
      - kind: node
        package: "@cargo-ai/cli@latest"
        bins:
          - cargo-ai
    homepage: https://github.com/getcargohq/gtm-skills
---

# Workspace health

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai project plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

A broken play stops being something a customer notices first. Every morning one agent reads the
last 24 hours against the seven days before and runs five checks:

| Check | A finding when |
| --- | --- |
| Failures, grouped by cause | a workflow's errors exceed `HEALTH_ERROR_RATE` of its runs (default 5%); an auth error names the connector to re-authorize |
| A play that stopped | it averaged at least one run a day and ran none, with whether it is disabled or just untriggered |
| Runs that succeed and write nothing | more than half the records a play touched still have the columns it writes empty |
| A credit spike | a workflow spent more than `HEALTH_SPEND_MULTIPLE` times its daily mean (default 2x), by more than `HEALTH_SPEND_FLOOR` |
| A stuck batch | pending or running for more than six hours |

It posts **only what is wrong and new**. It reads its own earlier posts in the channel, so a
finding already reported is not repeated each morning; it rolls into the Monday post, which lists
what is still open and what cleared, or says all clear with the week's run and credit totals.
Monday's post is what makes a quiet weekday mean healthy rather than a dead watcher.

It reports and never fixes. A rerun bills again, a disabled play may be disabled on purpose, and a
watcher that acts on its own findings is a second operator nobody reviews.

**What it is not.** It does not judge whether the work is the right work (`weekly-planning`) or what
the goal still needs (`goal-coverage`), and it does not do the deep dive on one failed run (the
pack's `cargo-diagnostics`, which each finding hands you the run for).

## Example

> Every morning, check our Cargo workspace and tell me in Slack if anything broke.

Illustrative output, fictional records:

```text
Workspace health: 3 new findings

1. HubSpot sync lost its connector: 212 of 230 runs failed since 06:10 with
   401 unauthorized at the write step. Re-authorize the HubSpot connector.
2. Tier Accounts has not run since Oct 19 (it averaged 3 runs a day): the play
   is disabled. Re-enable it if that was not on purpose.
3. Enrich new signups succeeded 140 times and wrote no company size on 131 of
   them. Open run 7c1e… to see what the provider returned.
```

On Mondays: "Workspace health, week of Oct 26: 1 still open (Tier Accounts), 2 cleared, 0 checks
skipped."

## Put it in your project

This folder is a **worked example**: real project resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-project` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it — the CLI does the copy.** From inside the project (the folder holding `cargo.json`),
   `cargo-ai project add cookbook/workspace-health` writes this example to
   `infra/workspace-health/` and this procedure to `.claude/skills/workspace-health/`. No project
   yet? `cargo-ai project init <dir> --cookbook workspace-health && cd <dir> && npm install` does
   both. **If you are reading this from the project's `.claude/skills/`, the install already
   happened — start at step 2.** On a CLI too old to have `add`, copy this folder in as a sibling of
   what is there by hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** If the project already has an Anthropic,
   GitHub or Slack connector, rewire the imports to the existing one and drop the copy; two
   resources with one slug is a collision at deploy.
3. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about; _What you can change_ is what you offer unprompted; _What you will be asked_ is the
   floor, and you derive before you ask. Record what you changed and why under a `## Decisions`
   section in your copy of this file.
4. **Check, then plan.** `node --import tsx evals/contract.mjs` from this skill's folder, then
   `npm run check && cargo-ai project plan` from the project root, show the diff, and deploy only on
   an explicit yes: `cargo-ai project deploy` (or merge, where a merge deploys). Never
   `cargo-ai project init --force` into a non-empty directory.
5. **Verify.** Run the agent once without waiting for the morning, then walk _Done when_ line by
   line and report each with evidence.

## What you will be asked

**Derive before you ask.** Only the rows marked _asked_ genuinely live in the operator's head.

| Input | Kind | How it is answered | Why it matters |
| --- | --- | --- | --- |
| Slack channel (`HEALTH_CHANNEL_ID` in `infra/agents/workspace-health.ts`) | value | **asked**: which channel the workspace owner reads. Resolve the name to its `C…` id with the Slack connector's channel autocomplete, and invite the Cargo app to it. | One constant locks both the post and the read-back. A different channel on each makes the agent repeat every finding daily; a channel the app is not in makes the read-back fail. |
| thresholds (`HEALTH_ERROR_RATE`, `HEALTH_SPEND_MULTIPLE`, `HEALTH_SPEND_FLOOR`) | value | **derived**: keep the defaults for the first week, then read the Monday post. Raise the error rate on enrichment-heavy workspaces where provider coverage misses are normal. | Too low and coverage misses read as outages; too high and a real outage hides under the line. |
| repository binding | value | **derived**: leave `repository` unset; `plan` fills it from the checkout's git origin. | The harness clones it for the `cargo-ai` toolchain. It never pushes. |
| Anthropic, GitHub, Slack connectors | value | **derived**: `cargo-ai connection connector list`; add a missing one with `cargo-ai project add connector/<name>`. | The model the run is billed against, the clone, and the post. |

## What you can change

| Variation | When it is right | How | What it costs |
| --- | --- | --- | --- |
| `daily-all-clear` | The team does not trust silence yet | In step 3 of `infra/agents/workspace-health.prompt.ts`, post the Monday line every day | A post every day that says nothing, which is how a channel gets muted. Move back to Mondays once trusted. |
| `twice-a-day` | Plays run on short schedules and a morning is too late | Add a second cron trigger and change the window in the prompt to 12 hours | Twice the runs; a 12-hour baseline is noisier for plays that run daily. |
| `skip-empty-outputs` | Models are wide and the empty-column check is slow or noisy | Drop check c from the prompt | The silent-success failure, the one nobody else catches, goes unwatched. |
| `page-on-auth` | A lost connector is urgent for you | Add a second `postMessage` use locked to an on-call channel, used only for auth findings | Two channels to keep locked; the contract eval needs updating to allow the third action. |

## What should not change

- **It reports and never fixes.** (`workspace-health.prompt.ts` §2, Never) A rerun bills again, a
  cancel can drop work in flight, and a disabled play may be disabled on purpose. A watcher that
  acts on its own findings is a second operator nobody reviews.
- **The post and the read-back share one locked channel.** (`HEALTH_CHANNEL_ID`) That read-back is
  the only memory. Split them and every finding is reposted every morning.
- **Never report a clean workspace it could not read.** (`workspace-health.prompt.ts` §2) A failed
  `whoami` posts the error. A silent watcher with no session reads exactly like a healthy
  workspace.
- **Group failures; never list them.** (`workspace-health.prompt.ts` §2a) Same node and same error
  is one finding with a count. Two hundred lines for one expired token is how a real second failure
  gets missed.
- **A threshold, not every error.** (`HEALTH_ERROR_RATE`) Enrichment that finds no email for some
  records is coverage, not breakage. Report every error and the channel is muted inside a week.

## Done when

- `node --import tsx evals/contract.mjs` passes: a `claudeCode` harness bound to an Anthropic
  connector and a model, no capability, exactly two connector actions (`slack.postMessage` and
  `slack.getConversationHistory`) locked to the same channel, a daily cron, and all three threshold env
  entries
- `cargo-ai project plan` reports the agent, its folder, and the three connectors
- the first run with a known problem in the workspace (a disabled play that used to run, or a
  workflow failing above the threshold) posted it once, naming the play and the cause
- every number in the post matches the same read re-run by hand
- a second run the same day, with nothing new, posted nothing
- on the first Monday it posted the weekly line, even with nothing new
- nothing in the workspace changed because of a run: no rerun, no cancel, no play enabled or
  disabled

## What it costs

The recurring cost is the harness run once a day, billed as LLM tokens through the bound Anthropic
connector. It scales with how much is wrong: a clean day is three list commands and five aggregate
queries; a bad day adds up to two `run get` reads per failing workflow. The workspace reads are API
calls, not connector actions, so they bill nothing, and the run never executes an action that
spends. Slack is one history read a day, plus a post only on days with something to say.

## Composes into

The pack's `cargo-diagnostics`, for the deep dive on the run each finding names. Pairs with
`goal-coverage` (what the goal still needs) and `weekly-planning` (are the bets on track).
