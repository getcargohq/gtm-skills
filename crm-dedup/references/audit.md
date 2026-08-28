# Audit CRM account duplicates

Use this reference before editing CDK. The audit is read-only: inspect live CRM company properties
and current account rows without paid calls, review requests, or CRM writes.

## Audit contract

Read current records from the CRM-backed `crm_accounts` model using the selected CRM record ID
(`hs_object_id` in the HubSpot example). Normalize identifiers with the pure helpers in
`infra/index.ts`, classify each cluster once, and rank its survivor deterministically. Write
`crm-account-dedup-audit-YYYY-MM-DD.json` and matching Markdown with this minimum contract:

```json
{
  "generated_at": "ISO-8601 timestamp",
  "crm": "hubspot|salesforce|attio",
  "source_model_slug": "crm_accounts",
  "record_id_field": "hs_object_id",
  "total_accounts": 0,
  "identifier_coverage": {
    "linkedin_company_id": 0,
    "linkedin_url": 0,
    "domain": 0,
    "no_supported_identifier": 0
  },
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
  },
  "policy": {
    "status": "pending_operator_approval|approved",
    "protected_id_fields": [],
    "score": {
      "linkedin_company_id": 60,
      "linkedin_url": 25,
      "non_generic_domain": 15
    },
    "automatic_merge_class": "exact_unique_linkedin_without_conflict",
    "survivor_precedence": [
      "protected_id",
      "customer",
      "open_opportunities",
      "contacts",
      "activities",
      "populated_properties",
      "last_activity_at",
      "created_at",
      "record_id"
    ],
    "review_owner": "operator-approved owner",
    "review_channel": "operator-approved Slack channel"
  }
}
```

Markdown headings are `Summary`, `Identifier coverage`, `Match classes`, `Conflicts and
exclusions`, `Score and automatic gate`, `Survivor policy`, and `Sample review queue`. JSON,
Markdown, and chat must agree on every count. Every table reports count, percentage of audited
accounts, and sampled CRM record IDs.

## Candidate classes

Use only normalized LinkedIn company ID, LinkedIn URL or handle, and non-generic domain as candidate
keys. Company name alone is not a candidate key.

| Candidate                                                                                                                | Execution path                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Exact LinkedIn company ID on every record, with no conflicting identity, protected ID, or parent-subsidiary relationship | Automatic merge after score and fresh CRM search                |
| LinkedIn URL or handle only                                                                                              | Human Review                                                    |
| Domain only                                                                                                              | Human Review                                                    |
| Junk or shared domain                                                                                                    | Exclude unless another supported key matches, then Human Review |
| Parent, subsidiary, brand, division, or regional entity                                                                  | Human Review                                                    |
| Conflicting identity or protected ID                                                                                     | Human Review or decline                                         |
| AI-assisted judgement                                                                                                    | Evidence for Human Review only                                  |

Count `identity_conflict` and `protected_id_conflict` separately. Present detected billing,
customer, and external-system identifiers before asking the operator to approve protected fields
and survivor precedence.

## Complete when

- identifier coverage and candidate counts agree across JSON, Markdown, and chat
- every candidate cluster contains at least two distinct CRM record IDs
- company name never creates a candidate
- every cluster has one mutually exclusive class and one deterministic survivor
- protected-ID, parent-subsidiary, and non-null identity conflicts are visible
- weak matching-key coverage produces a recommendation to run `crm-enrichment`, not name matching

