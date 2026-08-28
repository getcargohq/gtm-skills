# Deduplicate CRM accounts

Use this branch after enrichment has produced healthy LinkedIn company ID, LinkedIn URL, and domain
coverage, or immediately for a deduplication-only request when the live audit already proves that
coverage. The checked pipeline audits and proposes. It never merges CRM records.

## Contents

- [Audit contract](#audit-contract)
- [Classification](#classification)
- [Survivor policy](#survivor-policy)
- [Candidate materialization](#candidate-materialization)
- [Proposal play](#proposal-play)
- [Consumer-only merge contracts](#consumer-only-merge-contracts)
- [Complete when](#complete-when)

## Audit contract

Read current records from `crm_accounts`, using the selected CRM record ID (`hs_object_id` in the
HubSpot example). Normalize identifiers with the pure helpers in `infra/index.ts`, classify each
cluster once, and rank its survivor deterministically. Write
`crm-account-dedup-audit-YYYY-MM-DD.json` and matching Markdown with this minimum contract:

```json
{
  "generated_at": "ISO-8601 timestamp",
  "crm": "hubspot|salesforce|attio",
  "audit_run_id": "stable identifier for this approved audit",
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
    "review_owner": "operator-approved owner"
  }
}
```

Markdown headings are `Summary`, `Identifier coverage`, `Match classes`, `Conflicts and
exclusions`, `Survivor policy`, and `Sample review queue`. JSON, Markdown, and chat must agree on
every count. Every table reports count, percentage of audited accounts, and sampled CRM record IDs.
Keep duplicate account clusters separate from the `duplicate_properties` schema audit in
[`audit.md`](audit.md). Similar field names are a schema concern; multiple CRM rows for one company
are a record-identity concern.

## Classification

Use only normalized LinkedIn company ID, LinkedIn URL or handle, and domain as candidate keys.
Company name alone is not a candidate key.

| Candidate                                                                                        | Result                                                                                 |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Exact LinkedIn company ID on every record, with no conflicting non-null identity or protected ID | Future automatic class only after a fresh live reread and consumer-side merge approval |
| LinkedIn URL or handle only                                                                      | Review only                                                                            |
| Domain only                                                                                      | Review only                                                                            |
| Junk or shared domain                                                                            | Review only                                                                            |
| Parent, subsidiary, brand, division, or regional entity                                          | Review only                                                                            |
| Conflicting identity or protected ID                                                             | Exclude or review                                                                      |
| AI-assisted judgement                                                                            | Review evidence only                                                                   |

The class slugs are mutually exclusive. Count `identity_conflict` and `protected_id_conflict`
separately because one conflict cluster can carry both flags.

## Survivor policy

The default precedence in `selectSurvivor` is:

1. record with a protected business ID
2. customer record
3. most open opportunities
4. most contacts
5. most activities
6. most populated properties
7. latest activity
8. oldest creation time
9. lexicographically smallest CRM record ID

Present detected billing, customer, and external-system IDs before asking for policy approval.
Record every approved override and its exact precedence. The candidate materialization orders CRM
record IDs with the selected survivor first and writes the same ID to `survivor_id`.

## Candidate materialization

Materialize candidates only after the operator approves the refreshed audit and a maximum
15-cluster proposal run. Every `account_duplicate_candidates` row contains:

- non-empty `audit_run_id` matching the approved audit artifact
- non-empty `cluster_id`
- `source_model_slug: crm_accounts`
- at least two distinct `ordered_record_ids`, with the survivor first
- non-empty `survivor_id`
- one exact `match_class`
- normalized LinkedIn company ID when applicable
- identity and protected-ID conflict flags
- `stale: false` from the final live reread

Reject a row when cluster membership, identity values, protected IDs, or the survivor changed after
approval. Do not encode Attio record IDs as a string. Preserve the ordered array.

Resolve the candidate model UUID from `cargo.state.json`, then run
`cargo-ai storage model get-ddl <modelUuid>` before any write. Query the exact table for the approved
`audit_run_id`; stop if rows already exist, because bulk create is not an idempotent retry. Re-read
the live Cargo API schema, then insert the approved rows with `POST /storage/records/createBulk`:

```json
{
  "modelUuid": "resolved candidate model UUID",
  "records": [
    { "data": { "audit_run_id": "approved audit", "cluster_id": "cluster" } }
  ]
}
```

Send the full approved candidate contract in each `data` object. Verify the response count and
query the model again before running proposals. A count mismatch is a blocker, not a partial pilot.

## Proposal play

`deduplicate_accounts` consumes the native candidate model and emits a reasoned review proposal. It
is disabled, uses `noConcurrency`, and is limited to 15 clusters. The compiled workflow is
deterministic and contains native nodes only. Every outcome returns `approvedForMerge: false`.

Run `node --import tsx evals/contract.mjs` after every adaptation. It checks the candidate schema,
proposal-only graph, disabled pilot controls, classifier, normalization, and survivor precedence.

Structured AI review is optional. Add it only after the operator approves its current model cost,
and keep the result as evidence. It never changes `approvedForMerge` or selects the survivor.

## Consumer-only merge contracts

The checked pipeline contains no merge action. If a consumer later implements merge execution,
re-read the live integration schema and require a fresh CRM reread plus protected-ID guards before
every pair:

| CRM        | Action         | Payload shape to verify live                         |
| ---------- | -------------- | ---------------------------------------------------- |
| HubSpot    | `mergeRecords` | `{ objectType, primaryId, idsToMerge }`              |
| Salesforce | `mergeRecords` | `{ objectType, masterId, idToMerge }`                |
| Attio      | `mergeRecords` | `{ objectType, primaryRecordId, secondaryRecordId }` |

For Attio, validate each response and use its replacement record ID as the next primary ID. Fetch
the current action limit before implementation. These details belong in a consumer-only merge
workflow after separate operator approval, never in this repository example.

## Complete when

- identifier coverage and candidate counts agree across JSON, Markdown, and chat
- every cluster has at least two distinct CRM record IDs and one deterministic survivor
- classification uses the exact mutually exclusive slugs and records both conflict flags
- the operator approved protected IDs, survivor precedence, review ownership, and the exact pilot
- the candidate model contains only fresh, approved clusters from `crm_accounts`
- the disabled proposal play is limited to 15 clusters, uses `noConcurrency`, and contains no merge
  or paid action
- every output keeps `approvedForMerge: false`
- the report names every proposal, conflict, exclusion, and direct Cargo link
