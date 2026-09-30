# Context building

Populate the knowledge layer every other agent reads, from the three sources a company actually
has: its CRM, its calls and its public surface. Collected by two committed scripts, written by a
Claude Code harness agent as one pull request, refreshed monthly by a second one, answered from by
a third in Slack.

## What it does

- **Audits the CRM.** `scripts/collect/crm.ts` reads the last twelve months of closed deals, the
  accounts behind them and the contacts on the won ones, and writes one JSON snapshot under
  `cadence/log/raw/crm/`. Deterministic, no LLM, free. Its won count sets the mode: `verify` at
  twenty or more, else `hypothesis`.
- **Profiles the company.** The bootstrap runs a GTM profile method (ported verbatim from a public
  custom GPT, `references/gtm-profile-method.md` lists every changed line) on the domain and crawls
  the site, keeping a URL per claim.
- **Confirms three lines.** Target market, target personas, key competitors: shown as candidates,
  corrected by the operator, nothing else asked at that stop.
- **Pulls the postings.** `scripts/collect/jobs.ts` asks TheirStack for job postings per confirmed
  persona, inside the ICP size band at pull time, sized by a budget rule that reads the balance and
  the price from the workspace (`scripts/collect/budget.ts`).
- **Writes ten domains.** `global/`, `icp/` with a disqualifier, `persona/` with detection lists and
  buying roles, `jtbd/`, `alternative/`, `client/`, `proof/`, `objection/`, `signal/`, `insight/`.
  Every factual sentence tagged `[R]`, `[I]` or `[TR]`.
- **Stops.** One pull request, never merged. Then monthly: the refresh appends what the new calls
  and deals taught, proposes but never applies a change to `icp/` or `persona/`, and posts five
  lines to Slack.

## How it works

1. **Someone starts the bootstrap** (no cron; a CLI message or the workspace UI). It reads the
   workspace name back, lists what is connected, and prints the skip list: any domain with two or
   more entries is left alone.
2. **It runs the collectors** from the repository it cloned: the CRM audit, and `call-capture`'s
   collector if that cookbook is installed. The agent is told not to fetch anything itself.
3. **It profiles and crawls**, writes `global/`, `client/`, `proof/`, `alternative/` and `signal/`
   candidates, and stops for the three lines.
4. **It derives `icp/`, `insight/` and `objection/`** from the snapshot and the calls (verify mode)
   or from the profile (hypothesis mode, everything tagged inferred).
5. **It edits the persona pull spec** to the confirmed personas, runs the pull, reads the postings
   in batches to saturation, and writes `persona/` and `jtbd/`. Then it stops for the persona and
   reference-permission questions.
6. **It opens one pull request** whose body reports files per domain, tag counts, the mode and its
   numbers, the credit spend per pull, and the questions asked. A human merges; the next
   `cargo-ai cdk deploy` syncs `context/` into the workspace.
7. **Monthly, the refresh** reads the calls and deals since the last run, appends, opens one pull
   request, and posts the digest. **In Slack, the analyst** answers from what landed.

Adds 8 resources plus a script bundle.

| File                                     | Resource                          | Role                                                                              |
| ---------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| `infra/agents/context-bootstrap.ts`      | `defineAgent` (claudeCode)        | the one-shot populator: model, folder, no trigger, no env                          |
| `infra/agents/context-bootstrap.prompt.ts` | (not a resource)                | its contract: the nine steps, the two stops, the tags, the limits                  |
| `infra/agents/gtm-profile-method.ts`     | (not a resource)                  | the ported GTM profile method, appended to the bootstrap prompt                    |
| `infra/agents/context-refresh.ts`        | `defineAgent` (claudeCode)        | the monthly append: cron, locked Slack channel on `postMessage`                    |
| `infra/agents/context-refresh.prompt.ts` | (not a resource)                  | its contract: append only, never `icp/` or `persona/`, five lines                  |
| `infra/agents/gtm-analyst.ts`            | `defineAgent`                     | the consumer: read-only `context` capability, Slack trigger on listed channels     |
| `infra/connectors/anthropic.ts`          | `defineConnector` (`anthropic`)   | the model all three run on, billed and metered                                     |
| `infra/connectors/git.ts`                | `defineConnector` (`github`)      | the clone, branch, push and PR path, resolved by binding                           |
| `infra/connectors/slack.ts`              | `defineConnector` (`slack`)       | the digest's action and the analyst's trigger                                      |
| `infra/connectors/theirstack.ts`         | `defineConnector` (`theirStack`)  | the posting source, bound; own key or Cargo credits                                |
| `infra/folders/index.ts`                 | `defineFolder`                    | the workspace folder the agents are filed in                                       |
| `infra/models/persona-jobs.ts`           | (registers nothing by default)    | the builder for a standing model per persona, opt-in after the bootstrap           |
| `scripts/collect/crm.ts`                 | (not a resource)                  | the CRM audit entrypoint                                                           |
| `scripts/collect/audit.ts`               | (not a resource)                  | the `Crm` contract and the CRM-agnostic aggregation and file layout                |
| `scripts/collect/crms/`                  | (not a resource)                  | the HubSpot adapter and the registry                                               |
| `scripts/collect/jobs.ts`                | (not a resource)                  | the persona pull entrypoint                                                        |
| `scripts/collect/personas.ts`            | (not a resource)                  | the pull spec: titles, exclusions, band, limit, per persona                        |
| `scripts/collect/budget.ts`              | (not a resource)                  | the credit rule                                                                    |
| `scripts/collect/config.ts`              | (not a resource)                  | the CRM choice, the window, the lost-reason property, the verify line              |
| `scripts/collect/cli.ts`                 | (not a resource)                  | the one way the scripts reach Cargo: its CLI, signed in                            |

## The two halves, and where they land

This cookbook has one directory per layer it touches, and the install mirrors each into its
namesake in the project:

```
context-building/infra/     ->  infra/context-building/      what is declared and deployed
context-building/scripts/   ->  scripts/context-building/    what the agents run
```

Those are the layers `cargo-ai cdk init` already scaffolds, and `scripts/package.json` is what
stops the CDK loader importing the collectors and running them against the live CRM on every plan.

## Why the split

The collection and the judgement are different jobs, and the failure modes for mixing them are not
symmetric. A fetch loop an agent re-derives is a fetch loop that silently changes shape; the
snapshot is what every refresh is diffed against, so it is a committed script. The judgement is the
opposite: which titles are one persona, whether a lost reason is a pattern or a rep's habit, what
a case study actually proves. That produces a diff across sixty files, and `harness: "claudeCode"`
is what buys the working tree to produce it in.

## Why the personas are not a model

TheirStack has an extractor (`fetchJobs`) and an action (`searchJobs`) that take the same filters
and return the same rows. A `defineModel` on the extractor runs at creation, so declaring one per
placeholder persona bills a pull at deploy before anyone confirmed the persona; and a model
created by a script at run time is not adopted by a later declaration with the same slug. The
bootstrap therefore pulls through the action, which needs nothing deployed, so the postings and the
persona files land in one pull request. `infra/models/persona-jobs.ts` builds the standing model
from the same spec for the personas worth watching afterwards; `fetchJobs` is incremental, so that
model only bills new postings.

## Why the context is not in this folder

`defineContext` is a per-workspace singleton, and the knowledge layer belongs at the repository root
where humans edit it, which is exactly where `cargo-ai cdk init` already declares it. So this
folder ships none.

## Placeholders (edit before deploy)

1. **`channelId`** on the refresh's `postMessage` use, and **`channelIds`** on the analyst's Slack
   trigger (`infra/agents/context-refresh.ts`, `gtm-analyst.ts`). Ids, not names; never a
   customer shared channel.
2. **`languageModel`** on each of the three agents.
3. **`PERSONA_PULLS`** in `scripts/collect/personas.ts`: two placeholder personas the bootstrap
   replaces after the three-line confirmation. Do not edit them ahead of it.
4. **`LOST_REASON_PROPERTY`** in `scripts/collect/config.ts`, only when the audit's fill rate reads
   0 of N with lost deals in the window.

## What it does not do

It does not write the workspace context directly, contact anyone, write to the CRM, merge its own
pull request, edit `icp/` or `persona/` on a refresh, overwrite a seeded domain, deploy a model, or
spend past the budget rule without an operator passing `--over-budget` by hand.
