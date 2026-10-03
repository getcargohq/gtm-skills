---
name: slack-capture
description: 'Anyone @mentions the scribe in a Slack thread and the thread lands in the cadence log as a raw capture and a log entry, with any claim heard a second time across calls and threads promoted into the context knowledge layer, on one reviewable pull request per day. Triggers: "capture this slack thread into our knowledge base", "turn a customer thread into a note in the repo", "the best customer intel dies in slack", "@cargo capture this", "save deal-room discussions into context", "log what the team learned in slack". Cargo CDK, defineAgent, harness claudeCode, Slack connector trigger, getThread, GitHub, cadence, context. Skip when: you want an answer or a change from the repo in Slack, which is ask-cargo; or you want recorded calls scribed every morning, which is call-capture.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.92 or later, a Cargo workspace, an authenticated Anthropic connector, authorized Slack and GitHub connectors, and a GTM repository with `context/` and `cadence/` at its root (the shape `cargo-ai cdk init` scaffolds)."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/slack-capture
metadata:
  author: getcargo
  source: cookbook
  personas:
    - account-executive
    - revops
    - sales-leadership
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

# Slack capture

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

The customer intel that lands in Slack stops scrolling away. In any listed channel, someone replies
in a thread with `@Cargo capture this`, and one agent turns that thread into three things in your
repository:

1. **The raw capture.** The thread's messages, verbatim, with authors and timestamps, in
   `cadence/log/raw/slack/<date>-<account>.md`. The permanent archive, never edited or deleted.
2. **The log entry.** `cadence/log/slack/<date>-<account>.md`: what the thread was about, the intel
   under the same fixed headings call entries use (objections, competitors, buying signals, product
   asks), and the actions as checkboxes.
3. **The context update.** Where a first-hand claim has now been heard twice, across calls and
   threads together, the agent promotes it into `context/`, citing both occurrences.

It commits to the day's pull request (one per day, however many threads are captured), adds a
:white_check_mark: to the message that summoned it, and replies in the thread with the pull request
link. A human merges; the next `cargo-ai cdk deploy` syncs `context/` into the workspace context
every other Cargo agent reads.

This is the third source of the context layer, after `call-capture` and `web-capture`, and it
follows the same rules as the call scribe on purpose. A claim heard once on a call and once in a
thread is two occurrences of one fact in one layer, so the repetition bar counts both logs together.

Three properties make it safe to leave in a channel:

- **One thread, the one it was asked in.** The agent reads the thread it was mentioned in with
  `getThread`, and nothing else: no channel history, no search, no following links.
- **The pull request is the gate.** Its only write path is the repository. It never posts (the reply
  is its final text, which the trigger posts in the thread), never merges, and never touches the CRM.
- **The repetition bar.** One message is evidence in a log entry. It reaches `context/` only when a
  second, independent occurrence arrives. Two captures of the same thread are one occurrence.

## Example

> When someone in #deal-rooms says "@Cargo capture this", put the thread in our repo and add anything we've now heard twice to context.

Illustrative output, fictional records:

```diff
[slack-capture] 2026-10-07
Captured 2 threads · 1 context file promoted

+ cadence/log/raw/slack/2026-10-07-northwind.md
+ cadence/log/slack/2026-10-07-northwind.md
+   ## Competitors mentioned
+   - "Their procurement asked why not Globex, it's already in their stack" (first-hand,
+     relayed by Dana from the Oct 6 email)
+   ## Actions
+   - [ ] Dana: send the Globex comparison before Friday
+ context/objection/already-have-globex.md
+   Heard 2 times: cadence/log/calls/2026-09-22-fabrikam.md,
+   cadence/log/slack/2026-10-07-northwind.md
```

The thread got the reply `cadence/log/slack/2026-10-07-northwind.md · promoted
context/objection/already-have-globex.md · github.com/northwind/gtm/pull/341` and a
:white_check_mark: on the summoning message.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it — the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/slack-capture` writes this example to `infra/slack-capture/` and this
   procedure to `.claude/skills/slack-capture/`. No project yet?
   `cargo-ai cdk init <dir> --cookbook slack-capture && cd <dir> && npm install` does both. **If you
   are reading this from the project's `.claude/skills/`, the install already happened — start at
   step 2.** On a CLI too old to have `add`, copy this folder in as a sibling of what is there by
   hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** If the project already has a GitHub, Slack or
   Anthropic connector, or an agents folder, rewire the imports to the existing one and drop the
   copy; two resources with one slug is a collision at deploy. The knowledge layer needs no work:
   the scaffold already declares the repo's root `context/` in `infra/context.ts`, and
   `defineContext` is a per-workspace singleton, which is why this folder ships none.
3. **Pick the channels.** Set `channelIds` in `infra/agents/slack-scribe.ts` to the internal
   channels where customer intel is discussed — deal rooms, a customer-feedback channel, CS
   escalations — as `C…`/`G…` ids from the Slack connector's channel autocomplete, and invite the
   bot to each. Read `cargo-ai ai agent list` first: a channel listed here is taken from any
   `allChannels` agent (`ask-cargo`), so say which channels change hands.
4. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted; _What you will be asked_ is the floor, and you derive before you ask. If you
   are asking more than about four questions you have skipped lookups. Record what you changed and
   why under a `## Decisions` section in your copy of this file.
5. **Check, then plan.** `node --import tsx evals/contract.mjs` from this skill's folder, then
   `npm run check && cargo-ai cdk plan` from the project root. Show the diff, and deploy only on an
   explicit yes: `cargo-ai cdk deploy`. Never `cdk init --force` into a non-empty directory.
6. **Verify.** In a listed channel, start a test thread with two replies and mention the bot with
   "capture this". Walk _Done when_ line by line with the thread link and the pull request as
   evidence.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the ones marked
_asked_ genuinely live in the operator's head.

| Input                                                        | Kind  | How it is answered                                                                                                                                                                                         | Why it matters                                                                                                                                                                                  |
| ------------------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `channelIds` (`infra/agents/slack-scribe.ts`)                | asked | the internal channels where "capture this" is the job, as `C…`/`G…` ids from the connector's channel autocomplete. `cargo-ai ai agent list` shows which channels other agents already list.                  | A listed channel belongs to this agent, so `ask-cargo` stops answering there. A shared channel listed here would copy a customer's own words into your repository.                              |
| repository binding (`infra/agents/slack-scribe.ts`)          | value | **derived**: leave `repository` unset and `plan` fills it from the git origin of the checkout, taking the GitHub connector from the project's own. `cargo-ai cdk check` prints what it resolved.            | It is the only place a capture can land. An `owner/name` typed by hand is the one value nobody notices is wrong until a pull request opens against a stranger's repository.                     |
| Slack connector (`infra/connectors/slack.ts`)                | value | **derived**: `cargo-ai connection connector list` shows whether one is authorized; if not, `cargo-ai cdk add connector/slack` opens the OAuth consent.                                                       | It is both the trigger and the thread read. Without it the mention goes nowhere.                                                                                                               |
| GitHub connector (`infra/connectors/git.ts`)                 | value | **derived**: as above, with `cargo-ai cdk add connector/github`.                                                                                                                                           | It is the agent's entire write path. Without it the run reads the thread and has nowhere to put it.                                                                                            |
| LLM connector and model (`infra/connectors/anthropic.ts`)    | value | **derived**: `cargo-ai connection connector list`. Any Anthropic model pairs with `claudeCode`; `languageModel` is a placeholder to set.                                                                    | A harness runs against Cargo's LLM proxy, so this is what every capture is billed against. Pair `claudeCode` with an `openAi` connector and it typechecks green and fails at deploy.            |
| cadence and context paths                                    | value | **derived**: read `cadence/README.md` and `context/README.md`, and `ls cadence/log/` for what exists                                                                                                       | The repetition bar reads `cadence/log/calls/` and `cadence/log/slack/` together. A second parallel folder hides earlier occurrences and nothing ever promotes.                                  |

Checked before moving on, not after the deploy:

- every id in `channelIds` is an internal channel, read out loud from the autocomplete, and the bot
  is in it
- `cargo-ai cdk check` prints `agent:slack_scribe bound to <your repo>#<branch>` with no trailing
  subdirectory
- exactly one `defineContext` in the project, resolving to the repo's root `context/`
- `node --import tsx evals/contract.mjs` passes

## What you can change

| Variation             | When it is right                                                                   | How                                                                                                                                                  | What it costs                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `raise-the-bar`       | Context is filling with claims that turn out to be one rep's reading of one deal   | In §4 of `infra/agents/slack-scribe.prompt.ts`, require three occurrences, from different accounts                                                   | The knowledge layer lags the field. Keep it equal to `call-capture`'s bar, or the two scribes promote on different evidence and the layer stops meaning one thing.                          |
| `pr-per-thread`       | Captures are rare and each deserves its own review                                 | In §5 of the prompt, open one pull request per capture titled after the thread                                                                       | On a busy day the reviewer gets a pile of one-file pull requests, and two captures that promote the same claim conflict with each other.                                                     |
| `no-reaction`         | The team finds the :white_check_mark: noisy                                         | Drop `addReaction` from `uses` and the first sentence of §6                                                                                          | The reply in the thread is the only sign the capture landed. A failed run then looks the same as a quiet one until someone opens the thread.                                                 |
| `more-channels`       | Customer intel also shows up in general sales channels                             | Add their ids to `channelIds`                                                                                                                        | Those channels move from `ask-cargo` to this agent, so "@Cargo what's our ICP?" there gets a refusal to capture instead of an answer. Move a channel only when capture is its main job.      |

## What should not change

- **`channelIds`, never `allChannels`.** (`infra/agents/slack-scribe.ts`) `allChannels` puts this
  agent on every mention in the workspace beside `ask-cargo`, so every question gets two replies,
  and it reaches every shared channel the bot is in. The contract fails on it.
- **One thread, read once, through `getThread`.** (`infra/agents/slack-scribe.prompt.ts` §1) No
  channel history, no search, no following links. A capture someone asked for in one thread must not
  pull in a conversation nobody chose to keep.
- **No post action.** (`infra/agents/slack-scribe.ts`) The reply is the final text, posted by the
  trigger into the thread it was asked in. A `postMessage` on `uses` is only ever a way to write
  somewhere else. The contract fails on it.
- **Shared channels and DMs are refused.** (`infra/agents/slack-scribe.prompt.ts` §1) A Slack Connect
  thread is the customer's conversation as much as yours; copying it verbatim into your repository is
  not a call one @mention makes.
- **Raw captures are never touched, and one `source:` line is one capture.**
  (`infra/agents/slack-scribe.prompt.ts` §2) The `slack:<channel>/<parent ts>@<newest reply ts>` key
  is what makes a second mention of an unchanged thread a no-op and a grown thread a capture of only
  what is new. Let the agent rewrite entries and a re-mention re-litigates history.
- **A claim reaches `context/` only on its second independent occurrence, counted across calls and
  threads.** (`infra/agents/slack-scribe.prompt.ts` §4) Two captures of one thread, or a thread
  relaying a call already logged, are one occurrence. Count them as two and one conversation becomes
  something the whole company believes.
- **The agent opens or extends a pull request and never merges it.** Everything downstream reads
  `context/` as fact.
- **No capability.** (`infra/agents/slack-scribe.ts`) Context is edited as files in the checkout,
  under review. A context capability would be a second, unreviewed write path into it.

## Done when

- `node --import tsx evals/contract.mjs` passes
- `cargo-ai cdk plan` reports the agent, the three connectors and the folder
- a mention in a listed test thread produced one raw file under `cadence/log/raw/slack/` with every
  message verbatim and a `source:` line, and one entry under `cadence/log/slack/`
- the thread got one reply naming the entry and the pull request, and a :white_check_mark: on the
  summoning message
- a second mention with no new replies wrote nothing and replied with the existing entry
- a second mention after one new reply wrote a raw file holding only that reply
- two captures on the same day landed on the same `[slack-capture] <date>` pull request
- a claim already in one call entry, captured first-hand in a thread about a different account,
  was promoted into `context/` citing both; a claim with one occurrence was not
- a mention in an unlisted channel got no reply from this agent, and a mention in a shared channel
  was refused with nothing written

## What it costs

The thread read, the user lookup and the reaction are Slack connector actions. Immediately before the
plan, read their live prices and say each out loud:

- `cargo-ai orchestration action list getThread --kind connector --integration-slug slack`
- `cargo-ai orchestration action list addReaction --kind connector --integration-slug slack`

The recurring cost is the harness run itself, once per mention, billed as LLM tokens through the
Anthropic connector. It scales with the thread's length and with how much of `cadence/log/` and
`context/` the repetition check reads. There is no schedule and no fan-out: a quiet week costs
nothing.

## Composes into

`call-capture` (the repetition bar counts both logs), `standup` (the day's captures are evidence the
recap reads), and any agent with the `context` capability, such as `account-scoring`, which
reads what this promotes.
