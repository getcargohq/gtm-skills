# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `node --import tsx evals/contract.mjs` passes against the adapted graph: no CRM connector (unless
  `crm-backed` was applied and the assertion changed with it), native `people` and
  `companies`, an agent with no connector action or writable model that reads the context
  read-only, a disabled play on `changeKinds: ["added"]` that allow-lists `lead_source` and skips
  researched rows, and writes to the declared `cargo_*` columns only, never `owner_id`.
- `cargo-ai connection connector list` shows authorized Slack and Anthropic connectors.
- `icp.md` and `tiering-rubric.md` are in the project context, with no `PLACEHOLDER` left in the
  rubric.
- The capture that writes into `people` is named, and the `lead_source` values it writes
  are the play's allow-list.
- The Slack channel id was read out loud from the connector's autocomplete, the channel is internal,
  and the bot is in it. Every owner in the map was confirmed by the operator.

## Seeded test

Read the two model UUIDs from `cargo-ai storage model list`, then seed. Cargo generates every
record id (passing an `id` is rejected), so read each one from the `record.id` the create returns:

```sh
cargo-ai storage record create --model-uuid <companies uuid> \
  --data '{"name":"Fabrikam","website":"fabrikam.example"}'
# → record.id is <company id>
cargo-ai storage record create --model-uuid <people uuid> \
  --data '{"account_id":"<company id>","first_name":"Dana","last_name":"Ruiz","title":"VP Revenue Operations","email":"dana@fabrikam.example","lead_source":"demo_request","owner_id":"owner-id"}'
cargo-ai storage record create --model-uuid <people uuid> \
  --data '{"first_name":"Lee","last_name":"Park","email":"lee@contoso.example","lead_source":"purchased_list"}'
```

Keep the record JSON (`cargo-ai storage record get`) and the Slack permalinks as evidence.

- **Researched.** A manual run of the play researched Dana Ruiz: all four `inbound_*`
  columns are set, Fabrikam got `tier` and `tier_reason`, and one note landed in
  the `references/note.md` shape.
- **Not inbound.** Lee Park (a source outside the allow-list) was not researched.
- **Re-run.** A second manual run wrote nothing and posted nothing.
- **Account guard.** Setting `tier` on the account by hand, then seeding a second contact on
  it, left the hand-set tier in place.
- **Owner.** The mapped owner was mentioned; `owner_id` on the contact is unchanged.
- **Truth.** Every fact in the brief is in the record or on a listed source.

## Pilot and enable

- Ten real inbound contacts from the capture were researched by hand and read before enabling.
- After enabling, a contact written by the real capture was researched within fifteen minutes,
  once.

## Isolation

- This is one root skill. Its supporting Markdown lives under `references/` and `context/`, and no
  nested `SKILL.md` exists.
- No import leaves the folder.
