# CRM enrichment

Keep CRM accounts filled and refresh them when they go stale. New records get
approved blanks written from LinkedIn; a record whose successful fill is older
than six months comes back.

## What it does

- **Fills approved blank fields** on every new CRM account from LinkedIn — the
  starting recommendation is identity and size: company name, domain, website,
  LinkedIn page, employee count, and LinkedIn company ID as a durable matching
  key.
- **Re-enrolls stale records** whose last successful fill is older than six
  months, so firmographics stay current without manual refreshes.
- **Never overwrites** a value that is already there — the CRM is authoritative.
- **Stamps freshness only after a real fill** — a row where every field is
  already populated exits early without a paid call, and freshness is not
  stamped on a no-op.
- **Separates enrichment from writeback** — the reusable tool normalizes
  identifiers and returns provider data; the play calls that tool and owns
  the CRM write.

## How it works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CRM account extract                               │
│                     (crm_accounts: HubSpot, Salesforce, Attio)              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Managed segment trigger                              │
│         • Has identifier (LinkedIn URL or domain)                           │
│         • Freshness null OR older than 6 months                             │
│         • At least one approved blank                                       │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        account_enrichment tool                              │
│         • LinkedIn URL route (preferred) or domain route                    │
│         • Returns provider data, no CRM write                               │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          enrich_accounts play                               │
│         • Calls the tool                                                    │
│         • Fills approved blank fields only (skipIfExist)                    │
│         • Writes cargo_last_enriched_at + cargo_enrichment_status           │
│         • Disabled on first deploy, noConcurrency                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Audit and recommend.** The agent joins live LinkedIn fields and CRM
   properties, presents the starting recommendation and optional candidates,
   flags duplicates and transformations, and waits for approval of the complete
   field contract.
2. **Build disabled.** After approval, the agent adapts `infra/index.ts`,
   deploys the tool and play with the play disabled, sends Cargo UI links, and
   shows the exact target population and estimated credits.
3. **Run.** After cost approval, enrichment runs. The agent reports
   before-and-after fill rates, outcomes, failures, and actual credits.

## Architecture

| Resource             | Type  | Role                                                         |
| -------------------- | ----- | ------------------------------------------------------------ |
| `crm_accounts`       | Model | CRM account extract — play runs on this, writes back with ID |
| `account_enrichment` | Tool  | Reusable enrichment: normalizes IDs, returns provider data   |
| `enrich_accounts`    | Play  | Calls tool, fills blanks, owns writeback and freshness       |

The tool and play share one workflow contract — separate mappings would drift.
The play's filter is its managed segment; there is no standalone segment.

## Placeholders (edit before deploy)

1. **CRM connector and record ID** — `infra/index.ts`: the checked example uses
   HubSpot (`hs_object_id`). Salesforce uses `Id`; Attio uses the record id.
   Using the wrong ID field targets nothing and the run looks successful.
2. **Field mappings** — `infra/index.ts`: every destination must be a live
   property on the connected CRM. The agent derives these from live schemas.
3. **Freshness fields** — `cargo_last_enriched_at` (date) and
   `cargo_enrichment_status` (string) must exist on the CRM object.
4. **LinkedIn company ID property** — recommended as a durable matching key.
   Propose `linkedin_company_id` if one does not exist.

## Cost

Read this before pointing the skill at your CRM.

**Counting is free.** The audit phase makes no paid call — it reads schemas and
counts eligibility. The cost preview happens before any approval.

**Enrichment is per-row.** Every eligible row costs one LinkedIn call. The
price depends on the route:

- **LinkedIn URL route** — preferred, uses `enrichCompany`
- **Domain route** — fallback, uses `enrichCompanyFromDomain`

Run `cargo-ai connection integration get linkedin` to see current unit prices.
A row without an identifier makes no paid call. A row whose approved
destinations are already filled exits early (`skipped_already_filled`).

**Re-enrollment is six months.** After a successful fill, the record leaves the
segment for six months. The daily schedule processes only newly eligible rows
and records that come back due.

## Done when

- Audit JSON, Markdown, and chat summary agree on every count
- CDK plan shows `account_enrichment` tool and disabled `enrich_accounts` play
- Every destination is a live property on the connected CRM
- Records without identifiers or with all fields filled exit before a paid call
- The play targets `crm_accounts` and matches the audited CRM record ID
- LinkedIn and domain route counts are mutually exclusive and reproduce the
  credit estimate
- Post-run report shows fill rates, outcomes, failures, and actual credits

## Composes into

`account-scoring` (a filled book is what the scorer can cite),
`find-stakeholders` (the buyers at every filled account),
`tam-building` (the universe these records join).
