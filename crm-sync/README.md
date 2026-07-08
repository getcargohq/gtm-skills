# crm-sync

The CRM slot. A foundation cookbook, like `base-gtm`: it defines no motion of
its own, it gives the CRM-dependent cookbooks something to write to.

## Why this is separate from base-gtm

`base-gtm` deploys with **zero configuration**: its `accounts` and `contacts`
models are native (workspace-owned), so a fresh workspace can install a cookbook
and see it run without wiring a CRM first.

The CRM connector cannot be zero-config: it needs a real credential. Keeping it
here means the cookbooks that never touch a CRM (research-agent, meeting-prep,
tam-building, gtm-knowledge-graph) do not inherit a HubSpot token requirement
they have no use for. Importing a file **is** registration in the CDK, so a
connector sitting in `base-gtm` would be deployed by everyone, whether they use
it or not.

## What you need

Set `HUBSPOT_API_KEY` in your environment before deploy. `secret()` reads it at
deploy time and keeps it out of the content hash, so rotating the token does not
read as drift.

Swapping CRM: change the integration in `connectors/hubspot.ts` to `salesforce`
or `attio`. The downstream contract is only the two models in `base-gtm`, so
nothing else has to change.

## Sourcing accounts from the CRM

By default `base-gtm`'s models are native and are filled by a sourcing cookbook
(`tam-building`, `contact-sourcing`). To source them from the CRM instead, swap
the model for a connector-backed one: the exact shape is written out in the
comment at the top of `base-gtm/models/accounts.ts`. That is a one-line change
plus an import, and it is the only place the decision lives.

## Who requires this

Every cookbook that reads from or writes back to a CRM: `inbound-flow`,
`contact-sourcing`, `routing-engine`, `account-scoring`, `auto-enrichment`,
`plg-motion`, `ai-sdr`, and (once built) `crm-button`, `closed-won-multiplier`.
