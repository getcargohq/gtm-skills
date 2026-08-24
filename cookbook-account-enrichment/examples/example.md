# Example: adapt the Account enrichment play

This is a repository walkthrough, not a live CRM session.

1. Inspect the consumer project and authenticated CRM. Reuse its connector, CRM Account model, and
   native global Account model when present.
2. Audit live Account properties and fill rates for domain, website, LinkedIn URL, LinkedIn ID,
   last-enrichment, and enrichment-status fields.
3. Copy `infra/account-enrichment.ts`. The checked source is HubSpot-shaped. Keep it for HubSpot
   or replace its connector, extractor, record-write action, and fill-blank guard with the generated
   Salesforce or Attio types.
4. Replace `crmSourceKey` with the audited key from a native Account `ids` value. Replace every
   `crmFields` placeholder with an approved property. Keep fill-blanks for the base pilot and leave
   provider-schema-untyped fields out.
5. Intersect the play filter with the approved population. Keep the null-or-six-month freshness
   group, daily schedule, `changeKinds: ["added"]`, LinkedIn URL first, domain fallback second,
   `isEnabled: false`, and `limit: 15`.
6. Run `cargo-ai cdk types`, `cargo-ai cdk check`, and `cargo-ai cdk plan` in the consumer project.
   Fetch current LinkedIn action costs, then show the operator the exact mappings, row counts,
   pricing lookup time, and estimated credits. Stop before deploy.
