# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- The collector was run by hand once (`STANDUP_TIMEZONE=America/Los_Angeles npx tsx
  scripts/standup/collect/day.ts --dry-run`) and printed a dump for the timezone's
  current date, then the run without `--dry-run` wrote
  `cadence/log/raw/standup/<date>.md`.
- Running it a second time that same evening overwrote the same file, not a
  second one. The dump is a snapshot of the day, not an append-only archive of
  runs.
- `STANDUP_TITLE` is the short name that should appear in Slack, not the GitHub
  repo slug.
- `channelId` in `infra/agents/standup.ts` is a real Slack channel id (`C…`) the
  adopted Slack connector can post to, and the bot has been invited there. A
  name (`#general`) is the value that collides; autocomplete on the connector
  is how you get the id.
- `scripts/standup/package.json` exists in the project, and `cargo-ai cdk plan`
  did not run git or `gh` while planning. If it did, that file is missing and
  the loader is importing the collector.
- `cargo-ai cdk check` prints `agent:standup bound to <your repo>#<branch>` with
  no trailing subdirectory. The repo is the one holding `cadence/`, and the
  GitHub grant can push to it. A trailing `in infra/` means the harness was
  rooted where there is no node_modules, so the collector cannot run.
- `cargo-ai connection connector list` shows an authorized Slack connector, or
  `cargo-ai cdk add connector/slack` was used to open the OAuth consent.
- `node --import tsx evals/contract.mjs` passes against the adapted graph:
  harness is `claudeCode`, the platform capability is on the agent,
  `postMessage` is on `uses` with `channelId` locked.
- The cadence paths in the system prompt match what `cadence/README.md`
  describes, or the new folders are introduced deliberately and that README is
  updated to name them.

## First scheduled run

- Exactly one pull request, unmerged, titled `[cadence] log <date>`.
- The diff contains `cadence/log/raw/standup/<date>.md` and
  `cadence/log/<date>.md` with `## What moved`, `## What is stuck`, and
  `## Worth remembering`.
- No raw dump was deleted. An existing log section written by another run
  (a call entry, a Slack scan) is still there.
- Re-running the agent the same evening opens no second pull request and posts
  no second Slack message: the three sections already on the log file are the
  stop.
- The pull request body carries a `## Slack digest` section in Slack mrkdwn,
  and a line that is exactly one of `Slack digest posted at …` or
  `Slack digest not posted: …`.
- The digest landed in the locked channel, once, with `Full log: <PR URL>` as
  the last line. Spot-check the channel; this is the check nothing automated
  can do for you.
- A quiet day still produced an entry that says so, rather than skipping the
  run.
- No number, account, or quote in the log or the digest is absent from the
  raw dump, the cadence files, or a platform tool the agent actually called.
  Spot-check two bullets against the dump. A platform-tool error is a note
  on the PR, not a made-up count.

## Isolation

- This is one root skill. Its supporting Markdown files live under `references/`,
  and no nested `SKILL.md` exists.
- Slack posting goes through `slack.actions.postMessage` on the adopted connector
  (or `cargo-ai orchestration action execute` of that same action). No
  `SLACK_TOKEN`, no `chat.postMessage` script, no GitHub Action.
- `evals/contract.mjs` still passes after adaptation: harness is `claudeCode`,
  the platform capability is on the agent, `postMessage` is on `uses` with
  `channelId` locked, and no tool wraps it.
- Platform tools used on the first run were read-only (whoami, runs, usage,
  models). `execute_action` / `execute_action_batch` were not called. If the
  capability was not live yet, the PR says so and the recap continued from
  the git dump.
