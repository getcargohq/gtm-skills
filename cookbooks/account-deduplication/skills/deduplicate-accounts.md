# Deduplicate accounts

Duplicate account records are audited, classified, and emitted as non-destructive merge
proposals. The CRM remains authoritative. The shipped play contains no executable CRM merge
action.

## Classification

Use only normalized LinkedIn ID, LinkedIn handle, and domain as candidate keys. Company name
alone is not a candidate key.

| Candidate                                                                                 | Default result                                                                      |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Exact unique LinkedIn company ID on every record, no conflicting non-null identity values | the only future automatic class, after consumer live reread and protected-ID guards |
| LinkedIn URL or handle only                                                               | review only                                                                         |
| Domain only                                                                               | review only                                                                         |
| AI-assisted domain judgement                                                              | review only                                                                         |
| Name only, parent, subsidiary, protected-ID conflict, or unresolved identity conflict     | leave unmerged or send for review                                                   |

`cdk/agents/review-domain.ts` is the shared structured review agent example. Wire it into the importer
only when an LLM connector exists, otherwise remove it. AI never authorizes a merge.

## Proposal play

Configure `cdk/plays/<crm>/deduplicate-accounts.ts` with `noConcurrency`, a 15-cluster limit, and
disabled state. `approvedForMerge` stays false until a consumer implements live reread and
protected-ID guards, then adds merge actions in the consumer project only.

Before any consumer merge: reread all source records, normalize current identities, recompute the
survivor, and abort if cluster membership, identity values, protected IDs, or winner differ from
the approved candidate.

## Consumer-only merge contracts

The shipped templates do not call these actions. If a consumer later implements the mandatory
guards, re-read the live integration schema and use these verified payloads:

| CRM        | Action         | Required payload                                     |
| ---------- | -------------- | ---------------------------------------------------- |
| HubSpot    | `mergeRecords` | `{ objectType, primaryId, idsToMerge }`              |
| Salesforce | `mergeRecords` | `{ objectType, masterId, idToMerge }`                |
| Attio      | `mergeRecords` | `{ objectType, primaryRecordId, secondaryRecordId }` |

The survivor calculation must determine `primaryId`, `masterId`, or `primaryRecordId`. Never let
input order silently choose the winner.

## Attio

Attio merge replacement-ID chaining is a consumer-only concern: validate each response, use its
`new_record_id` as the next `primaryRecordId`, limit calls to five per second, and make one attempt
per pair. Do not add `mergeRecords` here.

After a reviewed pilot, offer a recurring candidate audit for new Accounts and changes to domain,
LinkedIn URL, or LinkedIn company ID. Keep proposal generation disabled until the operator approves
the schedule, and keep merge execution outside this cookbook.
