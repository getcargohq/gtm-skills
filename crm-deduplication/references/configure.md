# Configure CRM deduplication

Use this reference after the operator approves the audit, matching keys, protected fields, survivor
precedence, automatic-merge class, and manual-review destination.

## Build on the CRM model

Run `deduplicate_accounts` directly on the CRM-backed `crm_accounts` model. The folder is isolated,
so it declares a checked HubSpot connector and model. When the consumer project already has
compatible resources, rewire the play to them and remove the copies. The plan must contain one CRM
account model, not a candidate or staging model.

The play's filter requires the audited CRM record ID and at least one supported identifier. Keep
`isEnabled: false`, `runCreationRule: noConcurrency`, `limit: 15`, and a daily schedule.

For the checked HubSpot shape, verify the live integration before adaptation:

```sh
cargo-ai connection integration get hubspot
```

The checked graph uses these actions:

| Node                     | HubSpot action | Purpose                                                 | Required payload                                            |
| ------------------------ | -------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| Find duplicate companies | `findRecords`  | Search live companies using non-empty identity criteria | `objectType`, `criterias[]` with `propertyName` and `value` |
| Merge exact cluster      | `mergeRecords` | Merge automatically approved child records              | `objectType`, `primaryId`, `idsToMerge`                     |
| Merge reviewed cluster   | `mergeRecords` | Merge only after Human Review approval                  | `objectType`, `primaryId`, `idsToMerge`                     |

`findRecords` skips empty criterion values. Pass LinkedIn company ID, LinkedIn company page, and
domain. Retain the source CRM row exactly once in the cluster, normalize all candidate values, and
reject a generic-domain-only match. The search is the fresh CRM reread for that run.

Add one adopted Slack connector for Cargo's native Human Review node. Set connector cache duration
to 15 days. Replace `PLACEHOLDER_REVIEW_CHANNEL_ID` with the approved channel before planning. If no
review connector and channel can be resolved, keep the play disabled and stop before a pilot.

## Score and select the survivor

The compiled graph contains one native Scoring node after evidence preparation:

| Evidence                                                | Score |
| ------------------------------------------------------- | ----: |
| Exact LinkedIn company ID across the cluster            |    60 |
| Exact LinkedIn company URL or handle across the cluster |    25 |
| Exact non-generic domain across the cluster             |    15 |

The score explains confidence. It does not replace the conflict gate. A score of at least 60 can
merge automatically only when every record has the same non-empty LinkedIn company ID and every
conflict flag is false. LinkedIn URL plus domain remains manual even when both agree.

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

Map the approved protected-ID and parent-company properties into the checked workflow fields.
Update both survivor implementations together when the operator changes precedence.

## Guard merge and review

The automatic branch requires all of these:

- at least one other CRM record remains after the fresh search
- duplicate score is at least 60
- every record has the same non-empty normalized LinkedIn company ID
- no non-null LinkedIn ID, LinkedIn URL, or domain conflicts
- no protected business ID conflict
- no parent-subsidiary relationship inside the cluster

The yes path calls `mergeRecords` with the deterministic survivor as `primaryId` and every other CRM
record ID as `idsToMerge`. The no path enters native Human Review. Its message shows the score,
survivor, child IDs, conflict flags, and normalized candidate evidence. Approval calls the same
merge action. Decline or timeout ends with `review_declined_or_timed_out` and makes no CRM write.

If the source row is missing from the fresh search because an earlier queued merge absorbed it, end
as `source_missing_or_changed` before scoring or emitting merge IDs.

## Complete when

- the CDK plan contains only the CRM connector, review connector, CRM account model, and dedup play
- `deduplicate_accounts` runs directly on `crm_accounts`
- the graph is CRM search, preparation, native Scoring, deterministic survivor selection, guarded
  Branch, then CRM merge or native Human Review
- automatic merge requires exact shared LinkedIn company ID and every conflict guard
- Human Review approval reaches `merge_after_review`; decline and timeout reach the no-write end
- the play is disabled, uses `noConcurrency`, and limits the pilot to 15 CRM rows
- `node --import tsx evals/contract.mjs` passes after every adaptation

