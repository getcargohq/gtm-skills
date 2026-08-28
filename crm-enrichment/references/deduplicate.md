# Deduplicate CRM accounts

Use this branch after enrichment has produced healthy LinkedIn company ID, LinkedIn URL, and domain
coverage, or immediately for a deduplication-only request when the live audit already proves that
coverage. The build is one disabled play directly on the existing CRM account model. It does not
create a candidate or staging model.

## Contents

- [Audit contract](#audit-contract)
- [Candidate classes](#candidate-classes)
- [Build the CRM-model play](#build-the-crm-model-play)
- [Score and survivor policy](#score-and-survivor-policy)
- [Merge and manual-review gates](#merge-and-manual-review-gates)
- [Pilot and report](#pilot-and-report)
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
accounts, and sampled CRM record IDs. Keep duplicate account clusters separate from the
`duplicate_properties` schema audit in [`audit.md`](audit.md). Similar field names are a schema
concern; multiple CRM rows for one company are a record-identity concern.

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

The class slugs are mutually exclusive. Count `identity_conflict` and `protected_id_conflict`
separately because one conflict cluster can carry both flags.

## Build the CRM-model play

Reuse `crm_accounts` as `deduplicate_accounts.model`. Remove any `account_duplicate_candidates`
resource. The play's filter requires the audited CRM record ID and at least one supported identifier.
Keep `isEnabled: false`, `runCreationRule: noConcurrency`, `limit: 15`, and a daily schedule.

For the checked HubSpot shape, verify the live integration before adaptation:

```sh
cargo-ai connection integration get hubspot
```

The checked graph uses these live actions:

| Node                     | HubSpot action | Purpose                                                 | Required payload                                            |
| ------------------------ | -------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| Find duplicate companies | `findRecords`  | Search live companies using non-empty identity criteria | `objectType`, `criterias[]` with `propertyName` and `value` |
| Merge exact cluster      | `mergeRecords` | Merge automatically approved child records              | `objectType`, `primaryId`, `idsToMerge`                     |
| Merge reviewed cluster   | `mergeRecords` | Merge only after Human Review approval                  | `objectType`, `primaryId`, `idsToMerge`                     |

`findRecords` skips empty criterion values. Pass LinkedIn company ID, LinkedIn company page, and
domain. Retain the source CRM row exactly once in the cluster, normalize all candidate values, and
reject a generic-domain-only match. The search is the fresh CRM reread for that run. Do not replace
it with an audit snapshot.

Add one adopted Slack connector for Cargo's native Human Review node. Set connector cache duration
to 15 days. Replace `PLACEHOLDER_REVIEW_CHANNEL_ID` with the approved channel before planning. If no
review connector and channel can be resolved, keep the play disabled and stop before a pilot.

## Score and survivor policy

The compiled graph contains one native Scoring node after candidate preparation:

| Evidence                                                | Score |
| ------------------------------------------------------- | ----: |
| Exact LinkedIn company ID across the cluster            |    60 |
| Exact LinkedIn company URL or handle across the cluster |    25 |
| Exact non-generic domain across the cluster             |    15 |

The score explains confidence. It does not replace the conflict gate. A score of at least 60 can
merge automatically only when exact LinkedIn company ID is present across the cluster and every
conflict flag is false. A LinkedIn URL plus domain score remains manual even when both agree.

The default survivor precedence in `selectSurvivor` and `selectDuplicateSurvivorScript` is:

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
Map the approved protected-ID and parent-company properties into the checked workflow fields. Update
both survivor implementations together when the operator changes precedence.

## Merge and manual-review gates

The automatic branch requires all of these:

- at least one other CRM record remains after removing the source row
- duplicate score is at least 60
- every record has the same non-empty normalized LinkedIn company ID
- no non-null LinkedIn ID, LinkedIn URL, or domain conflicts
- no protected business ID conflict
- no parent-subsidiary relationship inside the cluster

The yes path calls `mergeRecords` with the deterministic survivor as `primaryId` and every other CRM
record ID as `idsToMerge`. The no path enters native Human Review. The review message shows the
score, survivor, and child IDs. Approval calls the same merge action. Decline or timeout ends with
`review_declined_or_timed_out` and makes no CRM write.

Run `node --import tsx evals/contract.mjs` after every adaptation. It checks the direct CRM-model
binding, absence of a staging model, CRM search, native score, automatic gate, Human Review routes,
merge nodes, classifier, normalization, survivor precedence, and pilot controls.

## Pilot and report

The disabled play can mutate CRM records when a pilot runs. After deployment, send the direct play
URL and ask the operator to approve all of these in one concrete gate:

- maximum 15 enrolled CRM rows
- exact automatic-merge class and score
- protected-ID and parent-subsidiary guards
- deterministic survivor precedence
- Slack review connector, channel, owner, and timeout
- current CRM, Slack, and optional AI action costs

Do not run the pilot on field-contract approval alone. After the approved run, report every
`no_duplicates`, `source_missing_or_changed`, `merged_automatically`, `merged_after_review`, and
`review_declined_or_timed_out` outcome. Include source IDs, survivor ID, score, conflict flags,
reviewer when present, CRM response, failures, and the direct play link. Re-read the surviving CRM
record and confirm every child ID no longer resolves as an independent company.

## Complete when

- identifier coverage and candidate counts agree across JSON, Markdown, and chat
- the CDK plan contains one CRM account model and no candidate or staging model
- `deduplicate_accounts` runs directly on `crm_accounts`
- the compiled path is CRM search, evidence preparation, native Scoring, deterministic survivor
  selection, automatic gate, then CRM merge or native Human Review
- company name never creates or scores a candidate
- the automatic path requires exact shared LinkedIn company ID and every conflict guard
- deterministic survivor selection agrees between the audit and workflow script
- Human Review approval reaches `merge_after_review`; decline and timeout reach the no-write end
- the play is disabled, uses `noConcurrency`, and limits the pilot to 15 CRM rows
- current CRM and review action schemas and costs were checked before pilot approval
- the operator approved the exact pilot and merge policy before execution
- the final report accounts for every search, score, review decision, merge, decline, timeout,
  survivor, exclusion, and failure
