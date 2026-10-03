# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `node --import tsx evals/contract.mjs` passes against the adapted graph: the model extracts
  contacts with no config filter, the agent has no CRM, Slack or writable model and reads the
  context read-only, the play is disabled on `changeKinds: ["added"]` and excludes researched rows.
- `cargo-ai connection connector list` shows authorized HubSpot, Slack and Anthropic connectors.
- `icp.md` and `tiering-rubric.md` are in the project context, with no `PLACEHOLDER` left in the
  rubric.
- The four contact properties and the two company properties exist in HubSpot
  (`listObjectProperties`).
- The Slack channel id was read out loud from the connector's autocomplete, the channel is internal,
  and the bot is in it. Every owner in the map was confirmed by the operator.

## Pilot

Keep the HubSpot record links and the Slack permalinks as evidence.

- **Ten contacts.** A manual run over ten recent inbound contacts wrote tier, brief, rationale and
  stamp on each, and posted ten notes in the `references/note.md` shape.
- **Company guard.** A company that already had `cargo_tier` kept it; a company without one got the
  inbound tier.
- **Truth.** For three sampled briefs, every fact is in the CRM record or on a listed source.
- **Re-run.** A second manual run over the same ten wrote nothing and posted nothing.
- **Not inbound.** A contact a rep created by hand during the pilot was not researched.
- **Owner.** A mapped owner was mentioned; an unmapped one was named by id; no owner changed.

## After enabling

- A test form fill was researched within an hour, once.

## Isolation

- This is one root skill. Its supporting Markdown lives under `references/` and `context/`, and no
  nested `SKILL.md` exists.
- No import leaves the folder.
