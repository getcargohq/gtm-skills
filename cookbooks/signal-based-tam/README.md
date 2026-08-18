# Signal-based TAM

Watch your whole account list for buying signals, and automatically reach out
the moment a high-intent one fires.

## What it does

- Monitors every account in `base-gtm` for signals (keyword mentions, job
  changes, content engagement) using the Sillage integration.
- Streams those signal detections into a data model, refreshed every 15 minutes.
- Filters the high-intent ones into a segment (your "living" target list).
- On each new signal, runs a play that drafts an AI outreach angle and posts it
  to Slack.

## How it works

1. **Sillage watches your accounts.** It monitors every account in the base
   `accounts` model for buying signals.
2. **Signals stream in.** New detections land in the `account-signals` model,
   refreshed every 15 minutes.
3. **The hot ones get flagged.** Detections matching your chosen signal types
   drop into the `hot-signals` segment.
4. **Outreach fires.** Each new signal triggers the `signal-to-outreach` play,
   which drafts an AI outreach angle and posts it to Slack.

Adds 4 resources on top of the base: 1 connector, 1 model, 1 segment, and
1 play (with an embedded workflow).

| File                          | Resource                        | Role                                                              |
| ----------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| `connectors/sillage.ts`       | `defineConnector`               | signal provider — zero config, runs on Cargo credits              |
| `models/signals.ts`           | `defineModel`                   | the signal feed — `listenSignals` over your accounts, 15-min sync |
| `segments/hot-signals.ts`     | `defineSegment`                 | the high-intent slice: chosen signal types only                   |
| `plays/signal-to-outreach.ts` | `definePlay` + `defineWorkflow` | per new signal: AI outreach angle + Slack alert                   |

## Placeholders (edit before deploy)

1. **Account column** — `models/signals.ts` `account.columnSlug`: the column
   holding each account's domain or LinkedIn company URL (`domain` for HubSpot).
2. **Persona** — `models/signals.ts` `persona`: which job titles / seniorities /
   locations to watch, or remove the block to skip lead matching.
3. **Slack channel** — `plays/signal-to-outreach.ts` `channelId` (the base Slack
   connector must be authenticated in the workspace).
4. **Signal types** — `segments/hot-signals.ts`: tune once real detections land.

## Done when

A signal detection shows up as a row in `account-signals` (before Sillage is
fully provisioned, you'll see one sample row so the schema is visible), it lands
in `hot-signals` if it matches, and the play posts the AI-drafted angle to Slack.

## Cost

Sillage bills 0.5 Cargo credit per signal item fetched. Monitoring is capped by
`account.limit` (default 1000 accounts, max 10000).
