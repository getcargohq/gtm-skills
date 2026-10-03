# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `node --import tsx evals/contract.mjs` passes against the adapted graph: both CRM models pull
  every column with no filter; the play is disabled, calls the analyst once and owns one
  `updateRecords` on `companies` matched on `hs_object_id` with exactly the three
  `cargo_expansion_*` properties; the analyst has no action and only read-only models; the digest
  has one locked `postMessage`, a writable ledger and `crm_companies` read-only.
- `cargo-ai connection connector list` shows authorized HubSpot, Slack and Anthropic connectors.
- The three company properties exist in HubSpot with the right types.
- After the first sync, a count over `crm_companies` with the play's filter returns the number of
  customers the team expects to be near renewal. Zero means the customer marker or the window is
  wrong for this portal.
- `context/expansion-plays.md` exists in the project and names what you sell to customers.
- `channelId` was read out loud from the connector's channel autocomplete, and the channel is
  internal.

## Pilot

Keep the HubSpot record links and the Slack permalink as evidence.

- **Five companies.** A hand run over five companies from the window writes a signal, a reason and
  a stamp onto each. Every event a reason names has a dated source in it, and every amount matches a
  deal in `crm_deals`.
- **Re-run.** A second hand run the same week judges none of the five again.
- **Nothing else written.** No deal, contact or owner in HubSpot changed during the pilot.
- **Digest.** The digest posts once, lists exactly the stamped companies with a signal other than
  `none`, at-risk first, with each reason as written on the record. A re-run that week posts nothing.

## Isolation

- This is one root skill. Its supporting Markdown lives under `references/`, and no nested
  `SKILL.md` exists.
- No import leaves the folder.
