# Contact sourcing

For every account you care about, find the right people, verify their emails,
and add them to your CRM — all on Cargo credits, no extra provider keys.

## What it does

- Matches each account against Cargo's business database.
- Pulls prospects that match your target persona (title, level, department).
- Enriches and verifies each person's email.
- Writes the valid ones to the CRM, deduped by email so re-runs don't duplicate.

## How it works

1. **Start from an account** in the base `accounts` model.
2. **Match + find people.** The `source-contacts` play matches the account
   against Cargo's business database and pulls prospects fitting your persona.
3. **Enrich + verify.** Each person is enriched and their email is verified
   through the waterfall (one pass per person).
4. **Write to CRM.** Valid contacts are upserted into HubSpot, deduped by email
   so re-runs don't create duplicates.

Adds 1 resource on top of the base: a play with an embedded workflow (with a
real per-person loop). The sourcing and enrichment connectors already live in
`base-gtm`.

## Placeholders (edit before deploy)

1. **Persona filters** — `plays/source-contacts.ts`: `job_level`, `job_title`,
   `job_department` on `fetchProspects`.
2. **Account filter** — the play ships as "has a domain"; replace with your own
   definition of which accounts to source for (tier, industry, score).

## Done when

Add one test account to the accounts
model: the play fires and verified persona contacts for that domain appear in
HubSpot with first/last/title set — and re-running does not duplicate them.

> Draft caveat: prospect fields off `fetchProspects` (e.g. `person.linkedin_url`)
> are loosely typed (`any`) until `cargo-cdk types` syncs the action schemas —
> confirm them on first run.
