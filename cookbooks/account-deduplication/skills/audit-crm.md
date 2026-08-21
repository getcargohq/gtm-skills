# Audit the CRM

Produce the deduplication audit from the existing Account model and audit importer. Re-read live
CRM properties.
Do not assume `cargo_` prefixes, a universal output schema, or that every account is in scope.

Write `account-dedup-audit-YYYY-MM-DD.json` and the matching Markdown tables. Use
[the acceptance contract](../evals/acceptance.md) as the minimum JSON shape, headings, and count
agreement. Adapt it only by adding consumer evidence, never by removing required classes or flags.

Normalize LinkedIn ID, LinkedIn URL or handle, and domain. Count every mutually exclusive match
class using the exact classifier slugs, then count identity and protected-ID conflict flags. Use
`cdk/context/candidate-contract.ts` in the audit importer, read from the selected CRM Account model,
and populate the typed candidate model. Record the selected CRM model slug in every candidate row.
The pure constructor is an example, not an automatically scheduled source.

## Stop conditions

- JSON, Markdown, and later play previews must agree on every count.
- Do not create or alter an Account model during audit.
- Do not merge CRM records during audit.
