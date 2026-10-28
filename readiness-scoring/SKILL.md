---
name: readiness-scoring
description: 'Keep a sales readiness score on every account that rises with each fresh signal and falls on its own as signals age: rounds, job postings, demo requests and any other account event land in Unify Account Events, a SQL model re-scores accounts hourly with a half-life per signal type, and accounts crossing your line are posted to Slack once. Triggers: "score accounts by recent engagement, older signals count less", "which accounts are ready to buy right now", "a lead score that decays over time", "signal decay", "tell me when an account heats up". Cargo project, Cargo Signals, unifyAccountEvents, defineQuery, Slack. Skip when: tiering accounts against your ICP, which is account-scoring; scoring a list once, which is score-leads; a one-time look at who raised, which is track-funding-rounds.'
version: "0.1.0"
compatibility: "Requires the cargo-project skill, a Cargo project (cargo.json at its root), @cargo-ai/cdk 1.0.127 or later (the native defineQuery model), a workspace on the BigQuery warehouse, a Slack connection, and accounts in a model that unifies into Unify Accounts (the example carries gtm_accounts). Cargo Signals needs no key of its own. No LLM connector and no CRM needed. The repository example does not deploy or bill anything until an agent adapts it in the consumer project."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/readiness-scoring
metadata:
  author: getcargo
  source: cookbook
  personas:
    - revops
    - sales-development
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

# Readiness scoring

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai project plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

A readiness score on every account with a recent signal, rebuilt every hour. Each signal counts
for its weight on the day it lands and loses half of that every half-life: a round raised is worth
a lot for months, a job posting for a few weeks, a demo request for a month. An account with no
new signal cools down on its own; nothing has to write a lower score. When an account crosses your
ready line, the team gets one Slack message with the score and the signals behind it.

It is timing, not fit. account-scoring decides whether an account is worth working at all and
rarely changes its mind; this decides whether now is the moment, and changes every hour. The two
compose: run both and route only tier A accounts that are ready.

**The decay is computed when the score is read, never stored.** A score written onto a row by a
play is right on the day it is written and wrong every day after, unless something rewrites every
row every hour. Here the events stay as they landed and a SQL model computes each one's age at
query time, so the score falls between signals by itself.

**Every signal goes through Unify Account Events.** The score reads that one model. A Cargo Signals
feed, a CRM's meetings or a demo-request form all reach the score by unifying there as account
events, with no change to the query. A signal type the settings do not weigh counts for nothing,
so a new feed never moves a score until someone has decided what it is worth.

**Two failure modes worth knowing before you start.** An event about a company that no account
model holds has no account, so Account Events drops it and it never scores: the watched accounts
must also be in a model that unifies into Unify Accounts. And `changeKinds: ["added"]` only posts
accounts that cross the line after the play is on; the ones already ready are not posted unless you
run the play once by hand.

## Example

> Score our accounts by recent engagement so older signals count for less, and ping #sales-ready when one heats up.

Illustrative output, fictional records:

```
Northwind (northwind.example) is ready (score 14.2)
3 recent signals. Strongest: fundraising 12d ago, demo_requests 2d ago, job_offers 9d ago.
```

| domain            | readiness_score | stage     | top_signals                                         |
| ----------------- | --------------- | --------- | --------------------------------------------------- |
| northwind.example | 14.2            | ready_now | fundraising 12d ago, demo_requests 2d ago, job_offers 9d ago |
| fabrikam.example  | 6.1             | warming   | job_offers 3d ago, job_offers 17d ago               |
| tailspin.example  | 2.4             | cold      | fundraising 290d ago                                |

Northwind is posted once, the hour it crosses the line. Tailspin's round is old enough that it no
longer counts for much, and nobody had to lower its score.

## Put it in your project

This folder is a **worked example**: real project resources written for some other company. The job
is to end up with the code your company would have written, in your project, and an agent does the
adapting.

**Install the required authoring skill first.** If `cargo-project` is absent, run:

```sh
npx skills add getcargohq/cargo-skills --skill cargo-project
```

Then read `.agents/skills/cargo-project/SKILL.md` directly; no session reload is needed. Complete its
bootstrap and use its authoring, state, plan, and deployment rules throughout. Stop before any
template work if the skill cannot be installed or read.

1. **Install it: the CLI does the copy.** From inside the project (the folder holding `cargo.json`),
   `cargo-ai project add cookbook/readiness-scoring` writes this example to
   `infra/readiness-scoring/` and this procedure to `.claude/skills/readiness-scoring/`. No project
   yet? `cargo-ai project init <dir> --cookbook readiness-scoring && cd <dir> && npm install` does
   both. **If you are reading this from the project's `.claude/skills/`, the install already
   happened: start at step 2.**
2. **Reconcile it with what is already declared.** This example carries `gtm_accounts`, a Slack
   connector and a Cargo Signals connector so it deploys on its own. When the project already
   declares any of them, rewire the imports to the existing one and delete the copy: one slug
   declared twice collides at deploy. When the watched accounts live elsewhere (tam-building's
   `tam_companies`, a CRM companies model), point both feeds' watchlist at that model and its domain
   column, and check that it unifies into Unify Accounts. `account_events` is adopted, not created:
   keep exactly one declaration of it in the project. This skill declares no `defineContext`.
3. **Inventory the events before you weigh them.** Run the inventory query in
   [`references/run.md`](references/run.md#inventory) on the live Account Events: which signal types
   and source models are already there, how many, how recent. Existing first-party events (demo
   requests, signups, meetings) are usually the strongest signals the workspace has and cost nothing
   to add.
4. **Set the weights.** Propose a weight and a half-life for each type worth counting, from
   [`references/weights.md`](references/weights.md), and have the operator correct them. They go in
   `infra/settings.ts`, the only file the score reads them from.
5. **Adapt and deploy, play disabled.** Work the sections below in order: _What should not change_
   is what you argue back about (say what breaks, then do it if they still want it); _What you can
   change_ is what you offer unprompted; _What you will be asked_ is the floor, and you derive before
   you ask. Record what you changed and why under a `## Decisions` section in your copy of this
   file. Then run `node --import tsx evals/contract.mjs` from this skill's folder, followed by
   `cargo-ai project types && cargo-ai project check && cargo-ai project plan` from the project root. Show the
   diff, and deploy only on a yes. Never run `cargo-ai project init --force` in a non-empty directory.
6. **Pilot, set the lines, enable.** Follow [`references/run.md`](references/run.md): read the score
   distribution, set the two thresholds from it, read the top accounts by hand, then enable the play.
   Walk _Done when_ line by line with evidence. Deployed cleanly and scored nothing is the normal
   failure.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked.

| Input              | Kind    | How it is answered                                                                                                                                       | Why it matters                                                                                                       |
| ------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `signals`          | asked   | Proposed from the inventory query and `references/weights.md`: a weight and a half-life per type, corrected by the operator                              | It is the one input that is a decision about the business: what a round is worth against a demo request, and for how long |
| `readyThreshold`   | derived | From the pilot's score distribution (`references/run.md`), confirmed by the operator after reading the top accounts                                      | Too low and the channel hears about every account; too high and it never fires                                         |
| `warmingThreshold` | derived | The score of one fresh mid-weight signal, so one more signal makes an account ready                                                                      | It is the nurture segment's edge                                                                                     |
| watched accounts   | derived | `gtm_accounts`, or the companies model the project already has (`cargo-ai storage model list`), with its domain column                                   | Cargo Signals bills per event delivered on these accounts, and an account outside Unify Accounts never scores          |
| feeds              | derived | The Cargo Signals feeds whose types got a weight. A type with no feed and no existing events is dropped                                                 | Each feed is billed per event; a feed nobody weighed is spend that moves nothing                                      |
| Slack channel      | asked   | The channel id, resolved through the Slack connector's autocomplete                                                                                      | Where the team reads it. A name, not an id, can resolve to the wrong channel                                          |

Checked before moving on, not after the deploy:

- `signals`: every key matches a `signal_type` or a model slug the inventory query returned, or a
  feed this deploy adds
- watched accounts: the model unifies into Unify Accounts, and its domain column holds bare domains
- the workspace is on BigQuery: `defineQuery` compiles the score for the workspace's warehouse, and
  the query in this example is BigQuery SQL

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the
default.

| Variation            | When it is right                                                                   | How                                                                                                                                                                                         | What it costs                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `first-party-events` | The workspace already has demo requests, signups, meetings or web sessions         | Add their model slugs to `signals` in `infra/settings.ts`; check each model unifies as an account event                                                                                     | Nothing billed. Web sessions are noisy: give them a low weight and a short half-life, or the busiest site visitors are always ready |
| `more-feeds`         | A signal type the team trusts is missing (M&A, growth, tenders, tech adoption)     | Add a Cargo Signals feed in `infra/models/signal-feeds.ts` on the same watchlist, and its type to `signals`                                                                               | Billed per event delivered, per feed. Check the feed's price with `cargo-ai connection integration get cargoSignals` first             |
| `fit-gate`           | account-scoring is installed and only tier A or B accounts should be routed        | Left join the tier model on domain in the score query and add a `tier` column; add a condition on it to the play filter                                                                   | An account the tier model does not hold is never routed, however hot it is                                                          |
| `contact-score`      | The motion is person-led (a champion's engagement, not the company's news)        | Copy the score model onto `object.contact_events`, keyed by `contact_id`; the person-level Cargo Signals types feed Contact Events by default                                             | A second score to read, and a person who changes jobs takes their score with them                                                   |
| `crm-stage`          | Reps work in the CRM and the stage should be a CRM field                           | A second play on the score model with `changeKinds: ["added", "removed"]` writing `stage` with `updateRecords` on the matching company, never creating one                               | One CRM write per account entering or leaving a stage. Writing only on entry leaves a stage in the CRM that the score has left       |
| `why-now-agent`      | The Slack line is not enough for a rep to act on                                   | An agent node in the play that reads the account's recent events and writes two sentences on why now                                                                                       | One LLM run per routed account. Keep it in the play, on routed accounts only, never in the hourly score                              |
| `cadence`            | Signals land daily and an hour of latency does not matter                          | Move the three crons to once a day, in the same order                                                                                                                                       | A ready account waits up to a day to be posted                                                                                     |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The decay is computed in the query, at read time.** (`infra/models/readiness-scores.ts`) A
  score written onto a row by a play stops decaying the moment it is written: the account stays
  ready forever, or every row is rewritten every hour.
- **Events stay as they landed.** (Account Events) The score reads them; nothing edits or deletes one
  to lower a score. An event rewritten to change its weight is history nobody can audit.
- **An unweighed signal type weighs 0.** (`ELSE 0` in the query) Default it to 1 and a new feed, or a
  noisy model someone unified for another reason, moves every score before anyone decided what it is
  worth.
- **One event per account, type and day.** (`select distinct` in the query) The same round arrives
  from two feeds, or twice from one; counted twice, it doubles a score with no new information.
- **The play reads `stage`, and only `stage`.** (`infra/plays/route-ready-accounts.ts`) A raw score
  in the play filter is a second copy of the threshold, and the two drift.
- **`changeKinds: ["added"]` stays.** (`infra/plays/route-ready-accounts.ts`) The model is rebuilt
  every hour; without it every ready account is posted every hour.
- **The three schedules stay in order: Account Events, then the score, then the play.** Out of
  order, each step acts on the previous hour's data, and a signal takes two hours to post.
- **The feeds watch a list.** (`infra/models/signal-feeds.ts`) Market scope delivers, and bills,
  every round and every posting in the market, and Account Events drops the ones on companies no
  account model holds.
- **No agent in the score.** An LLM call per account per hour is a bill with no judgment in it: the
  score is arithmetic on dated events.

## Done when

- the inventory query was run and every key in `signals` matches a type or model it returned, or a
  feed this deploy added
- the operator approved the weights and half-lives in `infra/settings.ts`
- the plan showed `account_events` adopted with its schedule, the feeds on a watchlist, the score
  model, two segments and the play **disabled**, and the operator approved the deploy
- after the first sync, `readiness_scores` has a row for every account with a weighed event inside
  the horizon, and an account with only old events scores below one with the same events fresh
- the thresholds were set from the pilot's distribution, and the top ten accounts were read by hand
  and agreed with
- the play was enabled, and the first account to cross the line was posted once, with its signals
- `node --import tsx evals/contract.mjs` passes against the adapted resources

## What it costs

**The score itself bills nothing in credits.** It is a SQL model rebuilt hourly over the workspace's
own warehouse, with no LLM and no connector call. The Slack post is one action per account that
crosses the line.

**Cargo Signals bills per event delivered**, per feed, on the watched accounts only. The first
delivery on a new watchlist looks back months, so the first days cost the most; each feed's
`dailyLeadLimit` caps them. Read the current per-event price with
`cargo-ai connection integration get cargoSignals` before the deploy, multiply by the watched
accounts and the events the pilot week delivered, and give the operator that estimate. First-party
events the workspace already has cost nothing to add.

## Composes into

`account-scoring` (the fit gate: route only accounts that are both ready and tier A),
`contact-sourcing` and `agentic-engagement` (what happens after the ping, on `ready_now_accounts`),
and every other Signals pipeline: once its model unifies as an account event, its events count as
soon as its slug has a weight.
