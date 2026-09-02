# Configure CRM deduplication

Use this reference after the operator approves the audit, matching keys, protected fields,
canonical-record rules, automatic-merge classes, low-confidence contact review behavior, and
manual-review destination.

## Build on CRM models

Run `deduplicate_accounts` directly on the CRM-backed `crm_accounts` model and
`deduplicate_contacts` directly on the CRM-backed `crm_contacts` model. The folder is isolated, so
it declares a checked HubSpot connector and two models. When the consumer project already has
compatible resources, rewire the plays to them and remove the copies. The plan must contain CRM
models only, not candidate or staging models.

Each play's filter requires the audited CRM record ID and at least one supported identifier. Keep
`isEnabled: false`, `runCreationRule: noConcurrency`, `limit: 15`, and a daily schedule.

For the checked HubSpot shape, verify the live integration before adaptation:

```sh
cargo-ai connection integration get hubspot
```

The checked graph uses these actions:

| Node                            | HubSpot action | Purpose                                                   | Required payload                                            |
| ------------------------------- | -------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| Find duplicate companies        | `findRecords`  | Search live companies using non-empty identity criteria   | `objectType`, `criterias[]` with `propertyName` and `value` |
| Merge exact account cluster     | `mergeRecords` | Merge automatically approved account child records        | `objectType`, `primaryId`, `idsToMerge`                     |
| Merge reviewed account cluster  | `mergeRecords` | Merge only after Human Review approval                    | `objectType`, `primaryId`, `idsToMerge`                     |
| Find duplicate contacts         | `findRecords`  | Search live contacts using non-empty identity criteria    | `objectType`, `criterias[]` with `propertyName` and `value` |
| Merge exact contact cluster     | `mergeRecords` | Merge automatically approved contact child records        | `objectType`, `primaryId`, `idsToMerge`                     |
| Merge reviewed contact cluster  | `mergeRecords` | Merge only after Human Review approval                    | `objectType`, `primaryId`, `idsToMerge`                     |
| Write canonical contact values  | `updateRecords` | Update approved non-empty values after a guarded merge    | `objectType`, matching record ID, `mappings[]`              |

`findRecords` skips empty criterion values. Accounts pass LinkedIn company ID, LinkedIn company
page, and domain. Contacts first run `prepare_contact_search_variants`, then pass LinkedIn person
ID, the four deterministic LinkedIn URL forms (`https://linkedin.com/in/<handle>`,
`https://linkedin.com/in/<handle>/`, `https://www.linkedin.com/in/<handle>`, and
`https://www.linkedin.com/in/<handle>/`), email, and the stored phone value. Retain the source CRM
row exactly once in the cluster, normalize all candidate values, and reject unsupported matches. The
search is the fresh CRM reread for that run.

The URL variant step closes the audit-vs-runtime asymmetry for LinkedIn URLs. Phone variants cannot
be exhaustively enumerated in CRM search. If phone-only duplicate coverage matters, offer a priced
and operator-approved `crm-enrichment` write-policy extension that normalizes stored phone values to
E.164 and normalizes LinkedIn URLs in the CRM, then rerun the affected rows.

Add one adopted Slack connector for Cargo's native Human Review node. Set connector cache duration
to 15 days. Replace `PLACEHOLDER_REVIEW_CHANNEL_ID` with the approved channel before planning when
any review path is enabled. Ask for a dedicated ops/review channel, not the customer's busiest
channel, and confirm the Cargo Slack app has been added to that channel before build. If no review
connector and channel can be resolved, keep both plays disabled and stop before a pilot.

## Score and select account survivors

The account graph contains one native Scoring node after evidence preparation:

| Evidence                                                | Score |
| ------------------------------------------------------- | ----: |
| Exact LinkedIn company ID across the cluster            |    60 |
| Exact LinkedIn company URL or handle across the cluster |    25 |
| Exact non-generic domain across the cluster             |    15 |

The score explains confidence. It does not replace the conflict gate. A score of at least 60 can
merge automatically only when every record has the same non-empty LinkedIn company ID and every
conflict flag is false. LinkedIn URL plus domain remains manual even when both agree.

The default account survivor precedence in `selectSurvivor` and `selectDuplicateSurvivorScript` is:

1. record with a protected business ID
2. customer record
3. most open opportunities
4. most contacts
5. most activities
6. most populated properties
7. latest activity
8. oldest creation time
9. lexicographically smallest CRM record ID

Map the approved protected-ID and parent-company properties into the checked workflow fields. Update
both survivor implementations together when the operator changes precedence.

## Score and select contact survivors

The contact graph contains one native Scoring node after evidence preparation. Each approved
high-confidence class scores enough to pass the automatic gate, but only when its conflict guard is
also true:

| Evidence                                                     | Score |
| ------------------------------------------------------------ | ----: |
| Exact LinkedIn person ID across the cluster                  |    60 |
| Exact LinkedIn person URL with no conflicting person IDs     |    60 |
| Exact non-generic email with no conflicting LinkedIn identity |    60 |
| Transitive high-confidence chain                             |    60 |

Everything else is low confidence: same phone only, generic or shared email, conflicting LinkedIn
person IDs, or conflicting LinkedIn identity. Low-confidence groups go to Human Review only when
the operator enabled that path at the policy gate. If not, they end as
`low_confidence_not_reviewed` with no CRM write. They never merge automatically under any
configuration.

The default Contact survivor precedence in `selectContactSurvivor` and
`prepareContactMergePayloadScript` is:

1. most associated deals
2. most activity logged
3. oldest creation time
4. most key properties populated
5. lexicographically smallest CRM record ID

Associated deals and activity counts depend on what the live CRM action exposes. If a criterion
cannot be derived from generated types, present that limitation at the policy gate and fall back to
the next available criterion. Keep the order deterministic and update the pure helper, workflow
script, and contract test together.

Professional email is not a canonical-record selection rule. The contact with the strongest CRM
history remains canonical; email and employment data are updated after the native merge only from
approved non-empty values prepared before the merge.

Transitive high-confidence chaining means every Contact in the group is connected to the group by
pairwise exact approved keys. For example, A shares LinkedIn person ID with B, and B shares
normalized LinkedIn URL with C without person-ID conflict. Treat the whole group as high confidence,
prepare one canonical Contact, and merge every secondary into that canonical Contact without
reselection.

## Guard merge, review, and contact write-back

The account automatic branch requires all of these:

- at least one other CRM record remains after the fresh search
- duplicate score is at least 60
- every record has the same non-empty normalized LinkedIn company ID
- no non-null LinkedIn ID, LinkedIn URL, or domain conflicts
- no protected business ID conflict
- no parent-subsidiary relationship inside the cluster

The contact automatic branch requires at least one other CRM record after the fresh search, score at
least 60, and one of the three approved high-confidence classes. The LinkedIn URL class requires no
conflicting LinkedIn person IDs. The email class requires an exact non-generic email and no
conflicting LinkedIn identity.

Automatic yes paths call `mergeRecords` with the deterministic survivor as `primaryId` and every
other CRM record ID as `idsToMerge`. Reviewed yes paths call the same merge action only after Human
Review approval. Decline, timeout, and review-disabled low-confidence contact groups end without a
CRM write.

For contact groups with more than two records, prepare serial merge steps into one canonical
Contact and do not reselect a survivor between merges. The checked graph passes the same canonical
ID and all secondary IDs to the CRM-native merge action; if the selected CRM requires one
secondary per call, adapt the action shape without changing the survivor between calls.

After a guarded contact merge, update the canonical Contact with prepared, non-empty, approved
people values only: email, phone, LinkedIn URL, LinkedIn person ID, job title, and primary associated
company ID. Let the CRM-native merge action handle all other contact properties, activities, deals,
company associations, and record associations. Do not create custom retention rules for other
fields.

Format contact Human Review evidence as one line per record:

`record id · name · email · LinkedIn person ID · job title · primary associated company ID`

Do not render raw JSON in the Slack card. If ambiguity needs a short same-person summary, add an
optional priced LLM step before Human Review and write its evidence-for/evidence-against summary
onto the card only. Do not let AI select the canonical Contact, change the deterministic
classification, or authorize a merge.

If the source row is missing from the fresh search because an earlier queued merge absorbed it, end
as `source_missing_or_changed` before scoring or emitting merge IDs.

## Complete when

- the CDK plan contains only the CRM connector, review connector, CRM models, and dedup plays
- `deduplicate_accounts` runs directly on `crm_accounts`
- `deduplicate_contacts` runs directly on `crm_contacts`
- each graph is CRM search, preparation, native Scoring, deterministic survivor selection, guarded
  Branch, then CRM merge or native Human Review / no-review end
- account automatic merge requires exact shared LinkedIn company ID and every conflict guard
- contact automatic merge requires one of the three high-confidence classes and its conflict guard
- contact search prepares LinkedIn URL variants before live CRM search
- transitive high-confidence contact chains are classified before the automatic gate
- Human Review approval reaches the reviewed merge; decline and timeout reach no-write ends
- review-disabled low-confidence contact groups reach `low_confidence_not_reviewed`
- contact write-back runs only after automatic or reviewed contact merges and writes only the six
  approved non-empty people fields
- contact Human Review cards contain formatted record lines and required Slack config keys
- each play is disabled, uses `noConcurrency`, and limits the pilot to 15 CRM rows
- `node --import tsx evals/contract.mjs` passes after every adaptation
