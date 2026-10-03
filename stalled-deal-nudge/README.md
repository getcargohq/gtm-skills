# Stalled-deal nudge

One Slack digest per owner every Monday, listing their open deals with no logged activity in the
last fourteen days: the line the last activity left off on, why the deal is worth a touch now, and a
follow-up drafted for them to send. A model extracts every HubSpot deal, one agent selects the quiet
ones in SQL, and a ledger keeps each deal to one nudge per week.

## What it does

- Syncs every HubSpot deal, every column, each morning.
- Each Monday, selects the open deals quiet for `QUIET_DAYS` or more, and drops any already nudged
  this ISO week.
- Reads the last note, meeting or call on each, and writes a reason and a draft grounded in it.
- Posts one digest per owner to a locked channel, then records each deal in the ledger.

## What's inside

Adds 8 resources.

| File                            | Resource                        | Role                                                            |
| ------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| `infra/agents/nudger.ts`        | `defineAgent`                   | the Monday cron, the model and CRM reads, the locked Slack post |
| `infra/agents/nudger.prompt.ts` | (not a resource)                | the SQL rule, the owner map, research, digest, ledger           |
| `infra/models/crm-deals.ts`     | `defineModel` (`fetchRecords`)  | every HubSpot deal, every column, synced daily                  |
| `infra/models/deal-nudges.ts`   | `defineModel` (native)          | the ledger: one row per deal nudged per week                    |
| `infra/connectors/hubspot.ts`   | `defineConnector` (`hubspot`)   | the extract and the read-only note lookups                      |
| `infra/connectors/slack.ts`     | `defineConnector` (`slack`)     | the post path                                                   |
| `infra/connectors/anthropic.ts` | `defineConnector` (`anthropic`) | the model the agent runs on                                     |
| `infra/folders/index.ts`        | `defineFolder` ×2               | where the agent and the models are filed                        |
| `references/digest.md`          | (not a resource)                | the digest shape and the rule for each line                     |

## Why one agent and not a play

The output is a digest grouped by owner, and grouping is a judgment over the whole list. A play
enrolls deals one at a time and would need a second step to gather them back into one post per
owner. The agent runs the selection itself, in SQL over a model that holds every deal, so the rule
is one readable query in the prompt.

## Placeholders (edit before deploy)

1. **`channelId`** in `infra/agents/nudger.ts`: the Slack channel id the digests land in.
2. **`OWNERS`** in `infra/agents/nudger.prompt.ts`: HubSpot owner id to the name the digest prints.
3. **`QUIET_DAYS`** in the same file: fourteen by default.
4. **The hour and timezone**: the cron (UTC) and the timezone named in the trigger `text`.
5. **`languageModel`**: any Anthropic model the workspace's connector can reach.

## What it does not do

It does not write to the CRM, send the drafts, message a prospect, post anywhere but the locked
channel, or edit the workspace context.
