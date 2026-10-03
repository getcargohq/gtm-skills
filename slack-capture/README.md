# Slack capture

Turn a Slack thread worth keeping into things a repository can hold: a raw archive, a log entry,
and, once a claim has been heard twice across calls and threads, an update to the knowledge layer
every other agent reads. Summoned by an @mention, scribed by a Claude Code harness agent, delivered
on one pull request per day.

## What it does

- **Reads one thread.** `@Cargo capture this` in a listed channel. The agent reads that thread with
  `getThread`, and nothing else.
- **Archives it.** The messages, verbatim, in `cadence/log/raw/slack/`, keyed by channel, thread and
  newest reply, so a re-mention of an unchanged thread is a no-op.
- **Scribes it.** `cadence/log/slack/<date>-<account>.md`, under the same headings as call entries.
- **Promotes.** A first-hand claim reaches `context/` only on its second independent occurrence,
  counted across `cadence/log/calls/` and `cadence/log/slack/` together.
- **Replies.** Adds the capture to the day's pull request, reacts with :white_check_mark:, and
  replies in the thread with the entry and the pull request link.

## How it works

1. **Someone @mentions the bot** in a thread in a listed channel. The Slack trigger opens one chat
   per thread.
2. **The harness clones the repository**, resolved from the checkout's git origin at deploy.
3. **The agent reads the thread**, refuses shared channels and DMs, and writes the raw file and the
   entry.
4. **It checks the repetition bar** against every call and Slack entry, and promotes what now has
   two occurrences.
5. **It commits to today's `[slack-capture]` pull request**, reacts, and ends its turn with the
   reply, which the platform posts in the thread.

Adds 5 resources.

| File                                    | Resource                        | Role                                                     |
| --------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| `infra/agents/slack-scribe.ts`          | `defineAgent` (claudeCode)      | the listed-channel trigger, the Slack reads, the model   |
| `infra/agents/slack-scribe.prompt.ts`   | (not a resource)                | read, archive, scribe, promote, pull request, reply      |
| `infra/connectors/slack.ts`             | `defineConnector` (`slack`)     | the trigger and the thread read                          |
| `infra/connectors/git.ts`               | `defineConnector` (`github`)    | the clone, branch, push and pull request path            |
| `infra/connectors/anthropic.ts`         | `defineConnector` (`anthropic`) | the model the harness runs on                            |
| `infra/folders/index.ts`                | `defineFolder`                  | where the agent is filed                                 |
| `references/entry.md`                   | (not a resource)                | the raw file, the entry, and the reply                   |

## Why a mention and not a reaction

Slack's agent trigger fires on a mention, so that is the act. It is the better one anyway: the
platform replies in that thread, so whoever asked sees what landed and where.

## Why listed channels

A channel listed on an agent belongs to it, and `allChannels` agents leave it alone. Listing the
deal rooms and feedback channels here keeps "capture this" there and leaves every other channel to
`ask-cargo`. `allChannels` would put two agents on every mention and reach every shared channel the
bot is in.

## Placeholders (edit before deploy)

1. **`channelIds`** in `infra/agents/slack-scribe.ts`: the internal channels where capture is the
   job.
2. **`languageModel`**: any Anthropic model the workspace's connector can reach.

## What it does not do

It does not post to any channel, read a thread it was not mentioned in, capture a shared channel or
a DM, write to the CRM, edit a raw capture or an existing entry, or merge its pull request.
