# Auto-enrichment (CRM freshness)

Keep your accounts and contacts filled in automatically. Every night, records
missing key fields get re-enriched — without overwriting anything a human typed.

## What it does

- Runs nightly for both accounts and contacts.
- Finds records missing key fields and enriches them through Cargo's waterfall
  (multiple providers with built-in fallback, so no provider keys and no
  if/else chains).
- Writes results back with `skipIfExist`, so existing human-entered values stay.

## How it works

1. **Nightly, two plays run.** `refresh-contacts` and `refresh-accounts` scan
   their models for records missing key fields.
2. **Enrich the gaps.** Those records go through the waterfall
   (`enrichContact` / `findPhone` / `enrichCompany`).
3. **Write back safely.** Results are written with `skipIfExist`, so any value a
   human already entered is left untouched.

Adds 2 resources on top of the base: 2 plays with embedded workflows.

## Placeholders (edit before deploy)

1. **Staleness filters** — both plays ship with "field is empty" filters
   (`jobtitle`, `industry`); extend with the columns your team relies on, or add
   a last-modified date condition.
2. **Write-back mappings** — match your CRM property names.

## Done when

Blank out `jobtitle` on a test contact (or `industry` on an account): the
nightly run (or a manual run) fills it back in, and fields that already had
values are left untouched.
