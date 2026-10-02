# Context seeding

Seed the knowledge layer every other agent reads, from the one source every company has on day
one: its public surface. Pulled by a committed script, written by a Claude Code harness agent as
one pull request, re-runnable when the site changes.

## What it does

- **Profiles the company.** The agent runs a GTM profile method (ported verbatim from a public
  custom GPT, `references/gtm-profile-method.md` lists every changed line) on the domain and
  crawls the site, keeping a URL per claim.
- **Confirms three lines.** Target market, target personas, key competitors: shown as candidates,
  corrected by the operator, nothing else asked at that stop. At setup, written into the pull
  request instead.
- **Pulls the postings.** `scripts/collect/jobs.ts` asks TheirStack for job postings per confirmed
  persona, inside the ICP size band at pull time, sized by a budget rule that reads the balance and
  the price from the workspace (`scripts/collect/budget.ts`).
- **Writes eight domains.** `global/`, `icp/` with a disqualifier, `persona/` with detection lists
  and buying roles, `jtbd/`, `alternative/`, `client/`, `proof/`, `signal/`. Every factual sentence
  tagged `[R]`, `[I]` or `[TR]`, every confidence `hypothesis`.
- **Stops.** One pull request, never merged. Nothing here reads a CRM, a call or Slack: those are
  other cookbooks' evidence, and what they learn later verifies or replaces what this seeded.

## How it works

1. **Someone starts it** from a chat, or a setup hook starts it with a domain and "setup mode".
   It reads the workspace name back and prints the skip list: any domain with two or more entries
   is left alone.
2. **It profiles and crawls**, writes `global/`, `icp/`, `client/`, `proof/`, `alternative/` and
   `signal/`, and stops for the three lines (or writes them into the pull request).
3. **It edits the persona pull spec** to the confirmed personas, runs the collector, reads the
   postings in batches to saturation, and writes `persona/` and `jtbd/`. Then it stops for the
   persona and reference-permission questions (or writes them into the pull request).
4. **It opens one pull request** whose body reports files per domain, tag counts, the spend per
   pull, and the questions. A human merges; the next `cargo-ai cdk deploy` syncs `context/` into
   the workspace.

Adds 5 resources plus a script bundle.

| File                                     | Resource                         | Role                                                                     |
| ---------------------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| `infra/agents/context-seeding.ts`        | `defineAgent` (claudeCode)       | the seeding agent: model, folder, no trigger, no env                     |
| `infra/agents/context-seeding.prompt.ts` | (not a resource)                 | its contract: the steps, the two stops and the setup mode, the tags      |
| `infra/agents/gtm-profile-method.ts`     | (not a resource)                 | the ported GTM profile method, appended to the prompt                    |
| `infra/connectors/anthropic.ts`          | `defineConnector` (`anthropic`)  | the model the harness runs on, billed and metered                        |
| `infra/connectors/git.ts`                | `defineConnector` (`github`)     | the clone, branch, push and PR path, resolved by binding                 |
| `infra/connectors/theirstack.ts`         | `defineConnector` (`theirStack`) | the posting source, bound; own key or Cargo credits                      |
| `infra/folders/index.ts`                 | `defineFolder`                   | the workspace folder the agent is filed in                               |
| `infra/models/persona-jobs.ts`           | (registers nothing by default)   | the builder for a standing model per persona, opt-in after the run       |
| `scripts/collect/jobs.ts`                | (not a resource)                 | the persona pull entrypoint                                              |
| `scripts/collect/personas.ts`            | (not a resource)                 | the pull spec: titles, exclusions, band, limit, per persona              |
| `scripts/collect/budget.ts`              | (not a resource)                 | the credit rule                                                          |
| `scripts/collect/cli.ts`                 | (not a resource)                 | the one way the script reaches Cargo: its CLI, signed in                 |

## The two halves, and where they land

```
context-seeding/infra/     ->  infra/context-seeding/      what is declared and deployed
context-seeding/scripts/   ->  scripts/context-seeding/    what the agent runs
```

Those are the layers `cargo-ai cdk init` already scaffolds, and `scripts/package.json` is what
stops the CDK loader importing the collector and calling TheirStack on every plan.

## Why one source

A cookbook is a prebuilt approach an agent follows. Give it two kinds of evidence, a page and a
deal, and it has to hold two confidence levels in one run and the reader has to tell them apart
afterwards. So this cookbook holds one: what is public, tagged as such. The CRM has its own
cookbook that verifies the seed against won and lost deals; calls have theirs. Isolated, each can
run on its own, and this one can run at workspace setup before anything is connected.

## Why the personas are not a model

TheirStack has an extractor (`fetchJobs`) and an action (`searchJobs`) that take the same filters
and return the same rows. A `defineModel` on the extractor runs at creation, so declaring one per
placeholder persona bills a pull at deploy before anyone confirmed the persona; and a model created
by a script at run time is not adopted by a later declaration with the same slug. The run therefore
pulls through the action, which needs nothing deployed, so the postings and the persona files land
in one pull request. `infra/models/persona-jobs.ts` builds the standing model from the same spec
for the personas worth watching afterwards; `fetchJobs` is incremental, so that model only bills
new postings.

## Why the context is not in this folder

`defineContext` is a per-workspace singleton, and the knowledge layer belongs at the repository root
where humans edit it, which is exactly where `cargo-ai cdk init` already declares it. So this
folder ships none.

## Placeholders (edit before deploy)

1. **`languageModel`** on the agent.
2. **`PERSONA_PULLS`** in `scripts/collect/personas.ts`: two placeholder personas the run replaces
   after the three-line confirmation. Do not edit them ahead of it.

## What it does not do

It does not read a CRM, a call, an inbox or Slack; write the workspace context directly; contact
anyone; merge its own pull request; overwrite a seeded domain; deploy a model; or spend past the
budget rule without an operator passing `--over-budget` by hand.
