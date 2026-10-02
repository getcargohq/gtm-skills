# Web capture

Keep the knowledge layer current from the one source every company has on day one: its own web
presence. Read by a committed script, written by a Claude Code harness agent as one pull request a
week.

## What it does

- **Reads the web, the same way every week.** `scripts/collect/web.ts` fetches the company's own
  pages, asks one news question for the days since the last snapshot, and writes
  `cadence/log/raw/web/<date>.json` with what changed: pages added, removed and changed, and news
  not seen before.
- **Seeds once.** The first run fills every empty `context/` domain: `global/`, `icp/` with a
  disqualifier, `alternative/`, `client/`, `proof/`, `signal/`. Every sentence tagged `[R]`, `[I]`
  or `[TR]`.
- **Adds what changed.** Every run after writes one dated `insight/<date>-web.md`, plus a file for
  a newly named customer or competitor. It never edits a file that exists; a change to one is a
  proposal in the pull request body.
- **Stops.** One pull request, never merged, or none in a quiet week. Nothing here reads a CRM, a
  call or Slack.

## How it works

1. **The Monday cron starts it** (the first run by hand). It runs the collector and lists the empty
   domains.
2. **It seeds what is empty**, then reads the snapshot's changes: each changed page against last
   week's text, each new news item, keeping what a reader of `context/` would want to know.
3. **It opens one pull request** with the snapshot and the files, or none when nothing is worth
   writing. A human merges; the next `cargo-ai cdk deploy` syncs `context/` into the workspace.

Adds 4 resources plus a script bundle.

| File                                | Resource                        | Role                                                     |
| ----------------------------------- | ------------------------------- | -------------------------------------------------------- |
| `infra/agents/web-scribe.ts`        | `defineAgent` (claudeCode)      | the scribe: model, folder, weekly cron, no env           |
| `infra/agents/web-scribe.prompt.ts` | (not a resource)                | its contract: the steps, the tags, what is never edited  |
| `infra/connectors/anthropic.ts`     | `defineConnector` (`anthropic`) | the model the harness runs on, billed and metered        |
| `infra/connectors/git.ts`           | `defineConnector` (`github`)    | the clone, branch, push and PR path, resolved by binding |
| `infra/folders/index.ts`            | `defineFolder`                  | the workspace folder the agent is filed in               |
| `scripts/collect/web.ts`            | (not a resource)                | the collector entrypoint                                 |
| `scripts/collect/snapshot.ts`       | (not a resource)                | page text, the snapshot and the diff, with no network    |
| `scripts/collect/config.ts`         | (not a resource)                | the domain, the pages and the news settings              |
| `scripts/collect/cli.ts`            | (not a resource)                | the one way the script reaches Cargo: its CLI, signed in |

## The two halves, and where they land

```
web-capture/infra/     ->  infra/web-capture/      what is declared and deployed
web-capture/scripts/   ->  scripts/web-capture/    what the agent runs
```

Those are the layers `cargo-ai cdk init` already scaffolds, and `scripts/package.json` is what stops
the CDK loader importing the collector and running the news search on every plan.

## Why the baseline is the last committed snapshot

The harness clones the default branch, so the only snapshot a run can diff against is one that was
merged. A quiet week opens no pull request and commits nothing, which is why the news window runs
from the last committed snapshot's date rather than a fixed seven days: the next run covers it. It
is also why the first run always opens a pull request, even when every domain was already seeded.

## Why one source

A cookbook is a prebuilt approach an agent follows. Give it a page and a deal in one run and the
reader cannot tell the two confidence levels apart afterwards. So this cookbook holds one: what is
public, tagged as such. The CRM has `win-loss-review`, which verifies the ICP this seeds; calls
have `call-capture`.

## Placeholders (edit before deploy)

1. **`DOMAIN`** and **`PAGES`** in `scripts/collect/config.ts`. The collector refuses the
   placeholder domain.
2. **`languageModel`** on the agent.

## What it does not do

It does not read a CRM, a call, an inbox or Slack; write the workspace context directly; edit a
file that exists; contact anyone; or merge its own pull request.
