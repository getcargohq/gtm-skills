---
name: standup
description: 'Every evening the GTM day is recapped into the cadence log and a digest is posted to Slack, as one reviewable pull request against your GTM repo. Triggers: "post the daily standup to slack", "end of day report in slack", "what happened today posted to slack", "keep a cadence log of each day", "replace the GitHub Action that posts our standup", "evening recap of the GTM day". Cargo CDK, defineAgent, harness claudeCode, GitHub, Slack, slack.postMessage, platform capability, cadence. Skip when: you want one recap of today in this chat with nothing deployed; or you want call transcripts scribed into context, which is call-capture.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.67 or later — 1.0.66 brought `harness` and the harness repository spec, 1.0.67 roots the agent at the package.json that declares the CDK rather than at `infra/`. On 1.0.66, declare `rootDirectory: \".\"` yourself. Also needs a Cargo workspace, a GTM repository with `cadence/` at its root (the shape `cargo-ai cdk init` scaffolds), and an authorized Slack connector."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/standup
metadata:
  author: getcargo
  source: cookbook
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

# Standup

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

What happened today stops living in someone's head until Monday. Every evening one agent
runs, and three things land:

1. **The raw dump.** A committed script writes git commits, pull requests, and the
   cadence files named for that day into `cadence/log/raw/standup/<date>.md`. That is
   the evidence, and it is never edited by the agent.
2. **The log entry.** The agent reads the dump, the workspace (runs, usage, models,
   via the platform capability), and whatever `cadence/` already holds (call entries,
   carryover, metrics if you have them), and writes `cadence/log/<date>.md`: what
   moved, what is stuck, what is worth remembering.
3. **The Slack digest.** The same recap, cut to what a teammate reads in fifteen
   seconds, posted through Cargo's `slack.postMessage` — not a Slack token, not a
   GitHub Action. The channel is locked on the action so the agent cannot pick a
   customer shared channel.

Then it opens one pull request and stops. A human merges the log. The Slack post
goes out from the run itself, the way the team actually reads the day; the pull
request is the reviewable record.

This is a scheduled CI workflow plus a hosted agent plus a Slack bot, collapsed
into resources declared in the same project as everything else the workspace
runs. The schedule, the repository binding and the Slack wiring live in
`infra/standup/agents/standup.ts`, and the instructions beside it in
`standup.prompt.ts`. `harness: "claudeCode"` is what buys the working tree: the
output of a day is a diff across markdown files, and only an agent with a
checkout can produce one.

Three properties make it safe enough to run unattended:

- **The collection is deterministic.** The agent does not fetch PRs. `scripts/collect/day.ts`
  does, the same way every evening, and the agent is told not to improvise that step.
  Workspace data (runs, usage, models) comes from the platform capability, not a
  second fetch the agent invents.
- **The pull request is the gate for the log.** The agent has repository write access
  and Slack `postMessage` to one locked channel. It cannot email anyone, cannot touch
  the CRM, and cannot merge itself.
- **The channel is locked.** `channelId` sits in the action's `config`, the same way
  `mailboxUuid` is locked on `sendEmail`. Leave it as a field the agent fills and a
  mistype posts the internal recap into a customer channel.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it — the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/standup` writes this example to `infra/standup/` (resources
   **and** `scripts/`) and this procedure to `.claude/skills/standup/`. No project yet?
   `cargo-ai cdk init <dir> --cookbook standup && cd <dir> && npm install` does both; this
   folder never ships a shell. **If you are reading this from the project's `.claude/skills/`, the
   install already happened — start at step 2.** On a CLI too old to have `add`, copy this folder in
   as a sibling of what is there by hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** If the project already has a GitHub connector, a
   Slack connector, or an agents folder, rewire the imports to the existing one and drop the copy;
   two resources with one slug is a collision at deploy. Append this folder's env needs to the
   project's `.env.example`; never overwrite it.
3. **Point Slack at your channel.** Authorize the Slack connector if the workspace does not have
   one (`cargo-ai cdk add connector/slack` opens the OAuth consent). Then set `channelId` in
   `infra/agents/standup.ts` to a channel id (`C…`) from that connector's channel autocomplete,
   invite the bot, and set `STANDUP_TITLE` to the short name that should appear in the header.
   `references/digest.md` (installed beside this file) is the digest shape.
4. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted (nobody asks for a variant they do not know exists); _What you will be asked_ is
   the floor, and you derive before you ask. If you are asking more than about four questions you
   have skipped lookups. Record what you changed and why under a `## Decisions` section in your copy
   of this file.
5. **Run the collector by hand once, then plan.** `npx tsx
   scripts/standup/collect/day.ts --dry-run` first: it prints the dump and writes nothing. Then drop
   `--dry-run`. If it does not produce a raw file locally it will not produce one on a schedule, and
   that is far cheaper to find out now. Then
   `node --import tsx evals/contract.mjs && npm run check && cargo-ai cdk plan`, show the diff, and
   deploy only on an explicit yes: `cargo-ai cdk deploy`. Never `cdk init --force` into a non-empty
   directory.
6. **Verify.** Walk _Done when_ line by line and report each with evidence. Deployed cleanly and
   produced nothing is the normal failure — and the second normal failure is a Slack post to the
   wrong channel, so read `channelId` out loud before you call this done.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the ones marked
_asked_ genuinely live in the operator's head.

| Input                                              | Kind  | How it is answered                                                                                                                                                                                                                          | Why it matters                                                                                                                                                                                                                          |
| -------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| repository binding (`infra/agents/standup.ts`)     | value | **derived**: leave `repository`, `defaultBranch` and `connector` unset and `plan` fills them from the git origin of the checkout, taking the GitHub connector from the project's own. `cargo-ai cdk check` prints what it resolved: confirm the line reads your repo and `./`. | This is the working tree the harness clones and the only place its log can land. An `owner/name` written by hand is the one value nobody notices is wrong until a pull request opens against a stranger's repository.                    |
| Slack connector (`infra/connectors/slack.ts`)      | value | **derived**: `cargo-ai connection connector list` shows whether one is authorized; if not, `cargo-ai cdk add connector/slack` opens the OAuth consent. The declaration is `adopt: true` because a deploy cannot mint an OAuth grant.           | It is the agent's entire post path. Without it the run writes the log and has nowhere to send the digest.                                                                                                                               |
| `channelId` (`infra/agents/standup.ts`)            | asked | the Slack channel id (`C…`) the digest is allowed to land in. Read it from the connector's channel autocomplete, not by guessing a name. Invite the bot.                                                                                      | Locked on `postMessage` so the agent cannot pick a customer shared channel. A name (`#general`) collides; an empty lock posts nowhere useful and looks like success.                                                                    |
| `STANDUP_TITLE` (`infra/agents/standup.ts`)        | asked | the short name in the Slack header (`:racing_car: *GTM - Sat Aug 1*`). A founder-facing label, not the GitHub slug.                                                                                                                          | Two standups in the same channel are told apart from the first line. A repo name here reads as infrastructure, not as the GTM day.                                                                                                      |
| GitHub connector (`infra/connectors/git.ts`)       | value | **derived**: `cargo-ai connection connector list` shows whether one is authorized; if not, `cargo-ai cdk add connector/github` opens the OAuth consent. The declaration is `adopt: true` because a deploy cannot mint an OAuth grant.         | It is the agent's entire write path into the repository. Without it the run does the work and has nowhere to put it.                                                                                                                    |
| cadence paths                                      | value | **derived**: read `cadence/README.md` and `ls cadence/log/` for what already exists                                                                                                                                                           | The agent writes into a layer humans already curate. A second parallel folder splits the record in half.                                                                                                                                |

Checked before moving on, not after the deploy:

- the collector was run by hand once and wrote a real raw file
- `cargo-ai cdk check` prints `agent:standup bound to <your repo>#<branch>` with no trailing
  subdirectory — the repo is the one holding `cadence/`, and the GitHub grant can push to it. A
  trailing `in infra/` is the failure to catch here: it roots the harness where there is no
  node_modules, so the collector cannot run
- `channelId` is a `C…` id the Slack connector can see, and the bot is in that channel
- `scripts/standup/package.json` is present in the project after the install
- `node --import tsx evals/contract.mjs` passes

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the
default.

| Variation        | When it is right                                                                                         | How                                                                                                                                                         | What it costs                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `move-the-hour`  | The team reads Slack at a different time, or you are not on Pacific time                                 | Change `cron` and `STANDUP_TIMEZONE` together in `infra/agents/standup.ts`. The cron is 05:00 UTC because that is 10pm PT in PDT.                           | A morning cron recaps an incomplete day. A timezone the collector does not share with the prompt splits the dump and the log across two dates.                         |
| `skip-slack`     | You want the log and the pull request, and a human will paste the digest                                 | Drop the `uses` entry and the "Post the Slack digest" section of `infra/agents/standup.prompt.ts`                                                           | The team stops seeing the day. The log still lands, but the thing people actually read is gone.                                                                        |
| `header-emoji`   | Two recaps land in the same channel and the reader has to tell them apart from the first line            | Change `:racing_car:` in `infra/agents/standup.prompt.ts` and `references/digest.md`                                                                        | Cosmetic unless you pick the same emoji as another bot in that channel, in which case the two posts merge in the reader's eye.                                         |
| `log-only-quiet` | A quiet day should not ping Slack                                                                        | In `infra/agents/standup.prompt.ts`, skip the post (and say so on the PR) when What moved is empty                                                          | Silence on a quiet day is indistinguishable from a missed run. The default is the opposite: a quiet day still gets an entry, because silence is signal.                |
| `no-platform`    | This agent must not have execute tools on it, even as a prompt-forbidden list                            | Drop `capabilities` in `infra/agents/standup.ts` and §1b of `infra/agents/standup.prompt.ts`                                                                | The recap loses runs, usage, and model movement. The git dump still lands. Until the capability is live on the workspace, the default already continues from the dump if the tools error. |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The agent does not fetch git; the script does.** (`scripts/collect/day.ts`) A fetch
  loop an agent re-derives every evening is a fetch loop that silently changes shape — a window
  that drifts, a `gh` flag that quietly widens. The raw dump is the one thing here that has to be
  byte-identical in its rules every day, because everything downstream is diffed against it.
  Cargo workspace data is the other half of the day, and it is the platform capability, not a
  `cargo-ai` CLI loop in the collector.
- **The platform capability is read-only.** (`infra/agents/standup.ts`,
  `infra/agents/standup.prompt.ts`) `execute_action` and `execute_action_batch` spend, and Slack
  posting is the locked `slack.postMessage` use, not a platform execute. Leaving those tools
  callable is how a standup starts a batch it cannot undo. Until the capability is on the
  workspace, the tools error and the recap continues from the git dump — it does not invent
  the numbers.
- **`slack.postMessage` is a connector action on the agent. `channelId` is locked in `config`.**
  (`infra/agents/standup.ts`) Wrapping it in a tool is ceremony, and this repo refuses those. A
  `SLACK_TOKEN` script, a GitHub Action, or a `chat.postMessage` curl is how the digest escapes
  Cargo: no run to inspect, no connector to revoke, and a token in the harness env that posts
  anywhere. Leaving the channel as a field the agent fills is how an internal recap lands in a
  customer shared channel.
- **`scripts/standup/package.json` stays.** (`scripts/package.json`) It is not
  decoration. The CDK loader imports every `.ts` under the project root except directories carrying a
  `package.json`; delete it and `cargo-ai cdk plan` imports the collector and runs git/`gh` on every
  plan.
- **The harness root stays the directory holding the `package.json` that declares `@cargo-ai/cdk`.**
  (`infra/agents/standup.ts`) That is where `node_modules` is, so it is the only place
  `npx tsx …/collect/day.ts` resolves — and in the scaffolded layout it is the repository root,
  which is also where `cadence/` lives. **Check it, do not assume it:** `cargo-ai cdk check`
  prints the resolved binding, and a line ending `in infra/` means the harness was rooted where
  there is no package.json and no node_modules. The collector then cannot run at all, and the
  evening reports clean and empty. On a CLI old enough to resolve it that way, pin
  `rootDirectory: "."` in the repository block until you upgrade.
- **The agent opens a pull request and never merges it.** (`infra/agents/standup.prompt.ts`) The
  log is what next Monday's plan is written from. Remove the review gate and a hallucinated
  number, a vendor call misread as pipeline, or a stuck item filed against the wrong owner
  becomes the team's memory of the day.
- **One log file per calendar day, and this run owns only its three sections.**
  (`infra/agents/standup.prompt.ts`) Several runs write the same day's file. Add What moved /
  What is stuck / Worth remembering, never rewrite a section you did not write, and stop when
  those three are already there — that is the idempotency key. Matching on the Slack channel
  instead is how a sibling bot's post (or a missed `conversations.history` action Cargo does
  not ship) made the FSD standup skip silently for nights at a time.
- **Do not invent a number.** (`infra/agents/standup.prompt.ts`) Drop a metrics line rather than
  carry yesterday's ARR forward. A made-up delta is worse than no delta, because the digest is
  what leadership reads. A platform-tool error is a note on the PR, not a count you fill in.

## Done when

- `--dry-run` printed the dump, and the run without it wrote `cadence/log/raw/standup/<date>.md`;
  running it twice that evening overwrote the same file
- `node --import tsx evals/contract.mjs` passes: harness is `claudeCode`, the platform
  capability is on the agent, `postMessage` is on `uses` with `channelId` locked, and no
  tool wraps it
- `cargo-ai cdk plan` reports the agent, the two connectors and the folder, and does **not** run
  git or `gh` while planning
- the first scheduled run opened one pull request titled `[cadence] log <date>` whose diff
  contains the raw dump and the three log sections, and whose body carries `## Slack digest`
  plus a posted-or-not line
- the digest landed once in the locked channel, with `Full log: <PR URL>` as the last line
- a re-run the same evening opened no second pull request and posted no second message
- a quiet day still produced an entry that says so
- no number in the digest is absent from the raw dump, a metrics file dated that day, or a
  platform tool the agent actually called. A platform-tool error is a note on the PR, not a
  made-up count

## What it costs

The collector talks to git and, when `gh` is installed, to GitHub from the harness environment.
Those calls are not Cargo connector actions.

The Slack post is `slack.postMessage` on the adopted connector. Immediately before the plan, run
`cargo-ai orchestration action list postMessage --kind connector --integration-slug slack` and
read the current cost. Say that number out loud as a per-post cost; the run posts once.

The recurring cost is the harness run itself, once a day, and it scales with how much the agent
reads — the dump, the day's cadence files, a short window of git history, and the platform
reads (whoami, runs, usage, models). There is no per-record fan-out. `execute_action` is on
the capability; this recap never calls it.

## Composes into

`call-capture` (yesterday's scribed calls are evidence this recap reads), `agentic-engagement`
(a thread that closed today is something that moved), `tam-building` and `account-scoring` (a
tiered book is a number the digest can name only when the metrics file actually moved).
