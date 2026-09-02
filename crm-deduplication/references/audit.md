# Audit CRM duplicates

Use this reference before editing CDK. The audit is read-only: inspect live CRM company and contact
properties and current CRM rows without paid calls, review requests, or CRM writes.

## Account audit contract

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

## Contact audit contract

Read current records from the CRM-backed `crm_contacts` model using the selected CRM record ID
(`hs_object_id` in the HubSpot example). Normalize email, LinkedIn URL, LinkedIn person ID, and
phone before comparison. Phone normalization starts with explicit international formats, `00`
prefixes, NANP, French trunk-prefix numbers, and UK trunk-prefix numbers. Search and group contacts
by normalized LinkedIn person ID, normalized LinkedIn URL, exact normalized email, and normalized
phone match keys. Build unique duplicate groups so the same contacts are processed once even when
they match on multiple identifiers.

Write `crm-contact-dedup-audit-YYYY-MM-DD.json` and matching Markdown with this minimum contract:

```json
{
  "generated_at": "ISO-8601 timestamp",
  "crm": "hubspot|salesforce|attio",
  "source_model_slug": "crm_contacts",
  "record_id_field": "hs_object_id",
  "total_contacts": 0,
  "identifier_coverage": {
    "linkedin_person_id": 0,
    "linkedin_url": 0,
    "email": 0,
    "phone": 0,
    "no_supported_identifier": 0
  },
  "candidate_groups": 0,
  "candidate_contacts": 0,
  "groups_by_identifier": {
    "linkedin_person_id": 0,
    "linkedin_url": 0,
    "email": 0,
    "phone": 0
  },
  "confidence": {
    "high_confidence_groups": 0,
    "low_confidence_groups": 0,
    "exact_linkedin_person_id": 0,
    "exact_linkedin_url_without_person_id_conflict": 0,
    "exact_non_generic_email_without_linkedin_conflict": 0,
    "phone_only": 0,
    "generic_or_shared_email": 0,
    "conflicting_linkedin_identity": 0
  },
  "policy": {
    "status": "pending_operator_approval|approved",
    "normalization": {
      "email": "lowercase and trim",
      "linkedin_url": "canonical linkedin.com/in handle",
      "linkedin_person_id": "exact trimmed value",
      "phone": "explicit international, 00-prefix, NANP, FR trunk-prefix, and UK trunk-prefix match keys"
    },
    "generic_or_shared_email_rule": {
      "role_based_local_parts": [
        "admin",
        "contact",
        "hello",
        "info",
        "office",
        "sales",
        "support",
        "team"
      ],
      "shared_email_with_conflicting_identity": true
    },
    "automatic_merge_classes": [
      "exact_linkedin_person_id",
      "exact_linkedin_url_without_person_id_conflict",
      "exact_non_generic_email_without_linkedin_conflict",
      "transitive_high_confidence_chain"
    ],
    "low_confidence_policy": "human_review|leave_untouched",
    "survivor_precedence": [
      "associated_deals",
      "activities",
      "created_at",
      "populated_properties",
      "record_id"
    ],
    "write_back_fields": [
      "email",
      "phone",
      "linkedin_url",
      "linkedin_person_id",
      "jobtitle",
      "associatedcompanyid"
    ],
    "review_owner": "operator-approved owner or null",
    "review_channel": "operator-approved Slack channel or null"
  }
}
```

Markdown headings are `Summary`, `Identifier coverage`, `Unique duplicate groups`, `Confidence
classes`, `Generic and shared email rule`, `Canonical Contact policy`, `Write-back policy`, and
`Sample review queue`. JSON, Markdown, and chat must agree on every count. Every table reports
count, percentage of audited contacts, and sampled CRM contact IDs.

## Account candidate classes

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

## Contact candidate classes

Use only normalized LinkedIn person ID, normalized LinkedIn URL, exact normalized email, and
normalized phone as candidate keys. Name alone, job title alone, company association alone, or fuzzy
person matching never creates a candidate.

| Candidate                                                        | Execution path                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| Same LinkedIn person ID                                          | Automatic merge after score and fresh CRM search     |
| Same normalized LinkedIn URL with no conflicting person IDs      | Automatic merge after score and fresh CRM search     |
| Same exact non-generic email with no conflicting LinkedIn identity | Automatic merge after score and fresh CRM search     |
| Pairwise transitive chain across those exact high-confidence keys | Automatic merge after score and fresh CRM search     |
| Same phone only                                                  | Human Review when enabled; otherwise leave untouched |
| Generic or shared email                                          | Human Review when enabled; otherwise leave untouched |
| Conflicting LinkedIn person IDs or conflicting LinkedIn identity | Human Review when enabled; otherwise leave untouched |
| AI-assisted judgement                                            | Evidence for Human Review only                       |

The generic or shared email rule is concrete: local parts `admin`, `contact`, `hello`, `info`,
`office`, `sales`, `support`, and `team` are generic, and an email shared across contacts with
conflicting LinkedIn identity is shared even when its local part is not role-based. Present this
definition at the policy gate and record the approved version in the audit contract.

HubSpot rejects creating a second Contact with the same email through the API, so exact-email
duplicate groups mostly come from UI imports, legacy data, or pre-existing portal state. Keep the
class because it is real in HubSpot and remains normal in Salesforce and Attio, but set expectations
that it is rarer in clean HubSpot API-created data.

Transitive chaining is high-confidence when every Contact in the group is connected by pairwise
exact approved keys and the relevant conflict guards stay false. Example: A and B share LinkedIn
person ID, while B and C share normalized LinkedIn URL and no conflicting person IDs. Merge all
three into one canonical Contact. Do not downgrade that group to low confidence merely because A and
C do not share the same direct key.

The default canonical Contact precedence is most associated deals, most activity logged, oldest
record, most key properties populated, then lexicographically smallest CRM record ID. If the live
CRM actions cannot expose associated-deal or activity counts, say so at the policy gate and fall
back to the next available criterion. The order must remain deterministic and must match the
adapted workflow and contract test.

Before merging, store the most recent approved non-empty people identity values available for the
person: email, phone, LinkedIn URL, LinkedIn person ID, job title, and primary associated company
ID. Only those six fields may be written back to the canonical Contact after a guarded native CRM
merge.

## Complete when

- identifier coverage and candidate counts agree across JSON, Markdown, and chat
- every candidate cluster contains at least two distinct CRM record IDs
- company name or person name never creates a candidate
- every cluster has one mutually exclusive class and one deterministic survivor
- protected-ID, parent-subsidiary, and non-null account identity conflicts are visible
- contact generic/shared email and LinkedIn identity conflicts are visible
- contact international phone match keys include explicit international, `00` prefix, NANP, French,
  and UK forms
- transitive high-confidence contact chains are counted as high-confidence groups
- contact low-confidence groups are either queued for Human Review when enabled or left untouched
- weak account matching-key coverage produces a recommendation to run `crm-enrichment`, not name
  matching
