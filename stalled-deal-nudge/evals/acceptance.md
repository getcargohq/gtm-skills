# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `node --import tsx evals/contract.mjs` passes against the adapted graph: `crm_deals` extracts
  every deal and every column with no filter, the agent reads it read-only, `deal_nudges` is
  writable, only `searchRecords` and `getRecord` on HubSpot, `postMessage` with `channelId` locked,
  no Slack read, a weekly cron.
- `cargo-ai connection connector list` shows authorized HubSpot, Slack and Anthropic connectors, and
  `languageModel` names a model the Anthropic one can reach.
- `OWNERS` covers every owner id that holds an open deal (`SELECT DISTINCT hubspot_owner_id` over
  open deals in `crm_deals`).
- `channelId` was read out loud from the Slack connector's channel autocomplete, the channel is
  internal, and the bot is in it.

## First runs

Keep the Slack permalinks, the selection SQL output and the ledger rows as evidence.

- **Selection.** The prompt's SQL, run by hand after the first sync, returns only open deals whose
  latest activity is older than `QUIET_DAYS`; a rep confirms a sample of five are genuinely quiet.
- **Digest.** The first run posts one digest per owner with stalled deals, in the
  `references/digest.md` shape, and writes one `deal_nudges` row per deal carrying the digest's
  Slack `ts`.
- **Re-run.** Sending the trigger text again the same week posts nothing and adds no row.
- **Next week.** A deal still quiet the following Monday appears again, marked as flagged one Monday
  running.
- **Failed post.** With the bot removed from the channel, the run posts nothing and writes no row;
  after the bot is invited back, the next run posts the digest.
- **Truth.** Every `Last:` quote and date exists in the CRM record it cites, and no CRM record was
  changed by the run.

## Isolation

- This is one root skill. Its supporting Markdown lives under `references/`, and no nested
  `SKILL.md` exists.
- No import leaves the folder.
- The run transcripts show no CRM write and no Slack call other than `postMessage`.
