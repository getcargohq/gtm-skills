# Standup

Turn the GTM day the team already lived into things a repository and a Slack channel can
hold: a raw evidence dump, a log entry a teammate can read on Monday, and a digest posted
through Cargo. Collected by a committed script, recapped by a Claude Code harness agent,
delivered as one pull request plus one Slack post.

## What it does

- **Collects.** `scripts/collect/day.ts` dumps git commits, pull requests, and cadence
  files named for the timezone's current date into `cadence/log/raw/standup/`.
  Deterministic, no LLM anywhere near it.
- **Recaps.** The agent reads the dump, the workspace via the platform capability
  (runs, usage, models), and whatever `cadence/` already holds, then writes
  `cadence/log/<date>.md`: what moved, what is stuck, what is worth remembering.
- **Posts.** The same recap, cut to a fifteen-second Slack digest, through
  `slack.postMessage` on an adopted Slack connector. The channel is locked on the use.
- **Stops.** One pull request, never merged. Slack goes out from the run; the log waits
  for a human merge.

## How it works

1. **The cron trigger fires** at 05:00 UTC (10pm PT during PDT), at the end of the
   timezone day.
2. **The agent clones the repository** — the project's own, resolved from the checkout's
   git origin at deploy rather than written down.
3. **It runs the collector** — `npx tsx scripts/standup/collect/day.ts` — which reads
   `STANDUP_TIMEZONE` from the harness environment. The agent is told not to fetch the
   day itself.
4. **It reads the workspace** through the platform capability: whoami, the day's
   runs, usage, models. Read-only. If those tools error because the capability is
   not live yet, it notes that on the pull request and continues from the dump.
5. **It writes the log**, then opens one pull request titled `[cadence] log <date>`.
6. **It posts the digest** by calling `slack.postMessage` (body only; channel, format and
   unfurling are locked), appending `Full log: <PR URL>`.
7. **A human merges** the log. The Slack post has already landed.

Adds 4 resources plus a script bundle.

| File                               | Resource                   | Role                                                              |
| ---------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| `infra/agents/standup.ts`          | `defineAgent` (claudeCode) | schedule, repository binding, platform capability, locked Slack use |
| `infra/agents/standup.prompt.ts`   | (not a resource)           | the recap contract: window, digest shape, limits                  |
| `infra/connectors/git.ts`          | `defineConnector` (`github`) | the clone, branch, push and PR path, resolved by binding        |
| `infra/connectors/slack.ts`        | `defineConnector` (`slack`)  | the post path; OAuth, adopted                                   |
| `infra/folders/index.ts`           | `defineFolder`             | the workspace folder this cookbook's resources are filed in       |
| `scripts/collect/day.ts`           | (not a resource)           | the entrypoint: dump git / `gh` / cadence files for the day       |

## The two halves, and where they land

This cookbook has one directory per layer it touches, and the install mirrors each into
its namesake in the project:

```
standup/infra/     ->  infra/standup/      what is declared and deployed
standup/scripts/   ->  scripts/standup/    what the agent runs
```

Those are the layers `cargo-ai cdk init` already scaffolds — `infra/` is the CDK project,
`scripts/` is "imperative glue for runtime surfaces the CDK cannot declare yet" — so a
cookbook that needs both contributes to both under its own name rather than inventing a
third place.

`scripts/package.json` is belt and braces. In a Manifest repo the CDK project root is
`infra/`, so nothing under `scripts/` is ever imported as a resource. In a project whose
CDK root is the repo root, the loader imports every `.ts` it finds **except** directories
carrying a `package.json` — without that file, `cargo-ai cdk plan` would import the
collector and run git/`gh` on every plan.

## Why the split

The collection and the judgement are different jobs, and the failure modes for mixing
them are not symmetric.

A fetch loop an agent re-derives every evening is a fetch loop that silently changes
shape: a window that drifts, a `gh` flag that quietly widens. Nothing downstream can
tell, because the dump is what everything downstream is diffed against. So the fetch is
a committed script and the agent is told not to improvise it.

The recap is the opposite. It is judgement — what actually moved, whether a quiet day
is signal, who owns the stuck item — and it produces a diff across markdown files plus
one Slack post. That is what `harness: "claudeCode"` buys: a working tree, the git
history to read before writing, and a pull request. The LLM `connector` and
`languageModel` fields are unused and omitted, because the harness brings its own model.

## Why Slack is a connector action, not a script

Cargo already has `slack.postMessage`. Putting a `SLACK_TOKEN` in the harness environment
and curling `chat.postMessage` would work, and it is exactly how this job used to ship
outside Cargo: a GitHub Action, a hosted agent, a bot token. Three moving parts, no run
to inspect, and a token that posts anywhere.

The channel lock is the safety property that token never had. `channelId` sits in the
action's `config`, the same way `mailboxUuid` is locked on `sendEmail`. The agent fills
`body`. Wrapping that one action in a tool is ceremony this repo refuses.

Cargo does not ship a conversations-history action, so duplicate detection is the log
file: if today's three sections are already there, this run has already happened. That
is also the more honest key. Matching on the Slack channel is how a sibling post, or a
missed history call, made an earlier version of this job skip silently for nights at a
time.

## Placeholders (edit before deploy)

1. **`channelId`** — `infra/agents/standup.ts`: a Slack channel id (`C…`) the adopted
   connector can post to. Invite the bot.
2. **`STANDUP_TITLE`** — `infra/agents/standup.ts`: the short name in the Slack header.
3. **`STANDUP_TIMEZONE`** — same file: IANA timezone the recapped calendar day is
   computed in. Change it together with `cron`.

## What it does not do

It does not contact customers, write to a CRM, merge its own pull request, execute a
platform action that spends, edit or delete a raw dump or an existing log section,
promote first-occurrence claims into `context/`, or touch `plan/` and `infra/`. It
reports the day; it does not change the strategy or the deployed engine.
