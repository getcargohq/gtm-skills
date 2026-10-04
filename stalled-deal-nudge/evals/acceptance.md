# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `node --import tsx evals/contract.mjs` passes against the adapted graph: no CRM connector in the
  example, `deals`, `companies` and `activities` read-only to the agent, `deal_nudges` writable, no
  connector action but `postMessage` with `channelId` locked, no Slack read, a weekly cron.
- `cargo-ai connection connector list` shows authorized Slack and Anthropic connectors, and
  `languageModel` names a model the Anthropic one can reach.
- `OWNERS` covers every owner id that holds an open deal (`SELECT DISTINCT owner_id` over open rows
  in `deals`).
- `channelId` was read out loud from the Slack connector's channel autocomplete, the channel is
  internal, and the bot is in it.

## First runs

Keep the Slack permalinks, the selection SQL output and the ledger rows as evidence.

- **Seed.** On a workspace with no deal data, seed test rows with
  `cargo-ai storage record create-bulk --model-uuid <uuid> --records '[{"data":{...}}]'` for each
  model (uuids from `cargo-ai storage model list`): two accounts; four open deals across two owners
  and one closed deal; activities so that two open deals were last touched more than `QUIET_DAYS`
  ago, one was touched yesterday, and one has no activity and an old creation date. Remove the seed
  rows with `remove-bulk` afterwards.
- **Selection.** The prompt's SQL, run by hand, returns exactly the three quiet open deals: never the
  closed deal, never the one touched yesterday. On real data, a rep confirms a sample of five.
- **Digest.** The first run posts one digest per owner with stalled deals, in the
  `references/digest.md` shape, and writes one `deal_nudges` row per deal carrying the digest's
  Slack `ts`.
- **Re-run.** Sending the trigger text again the same week posts nothing and adds no row.
- **Next week.** A deal still quiet the following Monday appears again, marked as flagged one Monday
  running.
- **Failed post.** With the bot removed from the channel, the run posts nothing and writes no row;
  after the bot is invited back, the next run posts the digest.
- **Truth.** Every `Last:` quote and date exists in the `activities` row it cites, and no deal,
  account or activity row was changed by the run.

## Isolation

- This is one root skill. Its supporting Markdown lives under `references/`, and no nested
  `SKILL.md` exists.
- No import leaves the folder.
- The run transcripts show no write but `deal_nudges` and no connector call other than `postMessage`.
