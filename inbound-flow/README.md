# Inbound flow

Turn every form or demo request into a verified, enriched CRM contact — then
qualify it, alert the team on hot ones, and define who owns what.

## What it does

- Takes an inbound submission (form, demo request) through one endpoint.
- Verifies the email and enriches the contact with missing details.
- Writes it to the CRM as a contact.
- Qualifies it against your ICP and posts hot leads to Slack.
- Defines the rep territories and per-rep capacity that decide ownership, and
  allocates each deliverable lead to a rep in that pool.

## How it works

1. **A submission arrives.** A form or demo request hits the `inbound-intake`
   tool, which runs the `qualify-inbound` workflow.
2. **Verify + enrich.** The workflow verifies the email and fills in missing
   contact details through waterfall enrichment (on Cargo credits).
3. **Write to CRM.** The contact is upserted into HubSpot.
4. **Qualify + alert.** It's scored against your ICP; hot leads post to Slack.
5. **Allocate an owner.** For deliverable leads the workflow calls the native
   `allocate` action, assigning the contact to a member of `inbound-reps`,
   capped by `inbound-capacity`.

Adds 3 resources on top of the base: 1 tool (with an embedded workflow),
1 territory, and 1 capacity.

| File                     | Resource                        | Role                                                     |
| ------------------------ | ------------------------------- | -------------------------------------------------------- |
| `tools/intake.ts`        | `defineTool` + `defineWorkflow` | the submission endpoint: verify → enrich → CRM → qualify |
| `territories/inbound.ts` | `defineTerritory`               | the rep pool, with routing weights and a fallback        |
| `capacities/inbound.ts`  | `defineCapacity`                | per-rep book caps over the base contacts model           |

## Placeholders (edit before deploy)

1. **ICP definition** — `tools/intake.ts`: the qualification prompt states your
   ICP in plain language.
2. **Slack channel** — `tools/intake.ts` `channelId`.
3. **Member uuids** — `territories/inbound.ts`: your workspace members
   (Workspace settings → Members), with weights.
4. **Identity column** — `capacities/inbound.ts` `idColumnSlug` if your contacts
   model doesn't key on `email`.

## Member allocation

The intake workflow calls the native `allocate` action after qualification —
`native.allocate({ ... })` referencing `inbound-reps` / `inbound-capacity` — so
deliverable leads get an owner automatically. The full native surface (including
`allocate`) is generated into `.cargo-ai/cargo-types.d.ts` by `cargo-cdk types`
(run on `postinstall`). `allocate`'s input is untyped (`Record<string, unknown>`);
the field shape is inferred from `RevenueOrganizationTypes.AllocatedBy` (the
record is keyed by `email`, the contacts capacity's `idColumnSlug`), so confirm
it on first `cargo-cdk plan`/run.

## Done when

Run the `inbound-intake` tool with a sample submission: the contact appears in
HubSpot with enriched fields, the run output shows the tier, and a "hot"
submission posts to the alerts channel. The territory and capacity appear under
the workspace's revenue organization.
