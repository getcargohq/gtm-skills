# The CRM audit

`scripts/collect/crm.ts` is the deterministic half of every run, the first pass and each month after: it reads
the CRM the same way every time and writes one JSON snapshot the agent reasons from. No LLM is
anywhere near it. This file is the snapshot's shape, the adapter contract, and how to add a CRM.

## What it reads, and through what

Everything goes through `cargo-ai orchestration action execute` against the workspace's CRM
connector, which the harness sandbox is already signed in to. Nothing here holds a credential.
HubSpot, the checked example, uses `hubspot.searchRecords` three ways:

| Read              | Filter                                                                                             | Notes                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| closed deals      | `hs_is_closed` is true, `closedate` inside the window, sorted by `closedate` descending             | HubSpot caps a page at 200. The window is walked by moving the upper bound to the last close date seen, deduplicating on id, until a page adds nothing. |
| accounts          | `hs_object_id` in a list of ids from `hs_primary_associated_company`                                | 100 per call.                                                                                                          |
| contacts on a deal | `associations.deal` is the deal id                                                                | The pseudo-property HubSpot's search API accepts; no association endpoint needed. Only won deals, newest first, capped by `MAX_WON_DEALS_FOR_CONTACTS`. |

A search returns every property on the object; the audit keeps the few it names. The one that is
not standard on every portal is the lost reason, `LOST_REASON_PROPERTY` in `config.ts`.

## The snapshot, `cadence/log/raw/crm/<YYYY-MM-DD>.json`

```
collectedAt          ISO timestamp
crm                  { integration, connectorSlug, connectorUuid }
window               { from, to, days }
mode                 "verify" | "hypothesis"   (won >= VERIFY_MIN_WON in the window)
pipelines[]          { id, closed, won, lost }  more than one is the one CRM question the operator gets
counts               { closed, won, lost }
lostReason           { property, lost, filled, values[] { value, deals } }
association          { closed, dealsWithContacts }
stakeholdersPerDeal  { won, lost } each { deals, mean, median, histogram {0,1,2,3+} }
deals[]              { id, name, pipeline, stage, outcome, closedAt, amount, currency, dealType,
                       lostReason, contactCount, companyId }
companies[]          { id, name, domain, industry, employees, country, revenue, won, lost }
wonDealContacts[]    { dealId, contacts[] { id, title } }
titlesOnWonDeals[]   { title, deals }   a title counts once per deal however many people share it
newSincePrevious     { previous: path | null, dealIds[] }
```

Every count travels with its denominator, because that is how the agent writes it into the
knowledge layer: "lost reason filled on 41 of 154 lost deals", never "27%".

No emails, no names of people: titles and ids only. The snapshot lives in a git repository.

One file per day, overwritten on a re-run. The previous day's file is what `newSincePrevious` is
computed against, which is how the monthly refresh knows which deals are new without a state file.

## Reading the numbers

- `mode: hypothesis` with a CRM connected means fewer than `VERIFY_MIN_WON` wins in the window. The
  ICP is then a hypothesis from the website that the CRM corroborates, and every claim is tagged
  `[I]`.
- `lostReason.filled` of 0 with lost deals in the window is almost always a custom property, not a
  team that never records reasons. Look for it in the CRM and set `LOST_REASON_PROPERTY`.
- `association.dealsWithContacts` well under `closed` means titles on won deals are a sample, and
  the persona reconciliation says so with the denominator.
- More than one entry in `pipelines[]` is the one question the audit produces: which pipeline is
  the sales pipeline. Partner, renewal and support pipelines close deals too, and they are not the
  same evidence.

## Adding a CRM

Write one object satisfying `Crm` (in `audit.ts`) beside `crms/hubspot.ts`, keyed in
`crms/index.ts` under its Cargo integration slug (`salesforce`, `attio`). Three methods:
`closedDeals(from, to)`, `companies(ids)`, `contactsOnDeal(dealId)`. Auth stays with Cargo; the
adapter only chooses actions and maps properties. Mark it `written: "docs"` until it has run
against a live workspace, and the collector prints a warning on every run until then. Nothing in
`audit.ts` changes: the window, the aggregation, the mode line and the file layout are the same
whoever holds the deals.

Salesforce: `Opportunity` with `IsClosed`, `IsWon`, `CloseDate`, `StageName`, `AccountId`; contacts
through `OpportunityContactRole` (`soqlQuery` is the simplest read). Attio: the `deals` object with
its status attribute, and the `associated_people` attribute for contacts.
