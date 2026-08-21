# Acceptance

Walk every line. A deployed-clean empty run is a failure.

## Dedup

- The dedup JSON follows this concrete contract and the Markdown renders the same values:

```json
{
  "generated_at": "ISO-8601 timestamp",
  "crm": "hubspot|salesforce|attio",
  "total_accounts": 0,
  "candidate_clusters": 0,
  "candidate_records": 0,
  "clusters": {
    "exact_unique_linkedin": 0,
    "linkedin_url_review": 0,
    "domain_review": 0,
    "junk_domain_review": 0,
    "parent_or_subsidiary_review": 0,
    "conflict": 0
  },
  "conflicts": {
    "identity_conflict": 0,
    "protected_id_conflict": 0
  }
}
```

Markdown headings are `Summary`, `Match classes`, `Conflicts and exclusions`, and `Sample review
queue`. Each table reports count, percentage of audited accounts, and sampled record IDs.

- The `clusters` counts use the exact classifier slugs and are mutually exclusive. Identity and
  protected-ID flags are counted separately because one conflict cluster may carry both.
- Candidate importer rows match the selected CRM play columns and include sampled source record
  IDs for operator review.
- Candidate clusters contain at least two records, every source record ID is nonempty, and Attio
  ordered record IDs are represented as an array rather than an encoded string.
- The selected CRM play is disabled, limited to 15 clusters, uses `noConcurrency`, and contains
  no merge action.
- Survivor precedence and protected IDs are recorded in the consumer's decisions.
- Attio replacement-ID chaining is documented, not implemented.

## Isolation

- The selected CRM folders contain no credentials, deployment command, or customer data.
- No relative import leaves this cookbook's `cdk/` resources.
- No standalone `defineSegment` is declared.
