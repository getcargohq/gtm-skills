# Configure

Reuse the consumer's CRM connector and extracts when they exist. If a
HubSpot companies or contacts model (or the Salesforce Accounts and Contacts /
Attio equivalents) is
already declared, import it as `crm_accounts` or `crm_contacts` and drop the copy. Two extracts
of the same object collide at deploy. Each play runs on its extract. There is
no native `accounts` or `contacts` unification in this skill. The same rule covers the Slack
connector the champion play alerts through.

Re-read the live provider and CRM actions before editing the template. These are LinkedIn
output paths, not CRM destinations. The company table was verified on 2026-08-21. Treat current
live schemas as authoritative.

| Group                | Exact output paths                                                                                                                                                              | Declared type                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Identity             | `company_id`, `company_name`, `linkedin_url`, `domain`, `website`                                                                                                               | string                                                                                                               |
| Profile              | `description`, `tagline`, `logo_url`, `email`, `phone`                                                                                                                          | string                                                                                                               |
| Size                 | `employee_count`, `follower_count`                                                                                                                                              | number                                                                                                               |
| Classification       | `employee_range`, `specialties`                                                                                                                                                 | string                                                                                                               |
| Classification       | `industries`                                                                                                                                                                    | array of strings                                                                                                     |
| Headquarters         | `hq_address_line1`, `hq_address_line2`, `hq_city`, `hq_country`, `hq_full_address`, `hq_postalcode`, `hq_region`                                                                | string                                                                                                               |
| Other offices        | `locations`                                                                                                                                                                     | array of objects with `city`, `country`, `full_address`, `is_headquarter`, `line1`, `line2`, `region`, and `zipcode` |
| Affiliates           | `affiliated_companies`                                                                                                                                                          | array of objects with `company_id`, `linkedin_url`, and `name`                                                       |
| Funding              | `funding_info.crunchbase_url`                                                                                                                                                   | string                                                                                                               |
| Funding              | `funding_info.last_funding_round_amount`, `last_funding_round_currency`, `last_funding_round_month`, `last_funding_round_type`, `last_funding_round_year`, `num_funding_rounds` | provider-schema-untyped                                                                                              |
| Founding             | `year_founded`                                                                                                                                                                  | provider-schema-untyped                                                                                              |
| Domain fallback only | `confident_score`                                                                                                                                                               | string                                                                                                               |

### Person actions (people path)

The contact tool calls `linkedin.enrichProfile` (input `linkedinUrl`) and, for rows without a
profile URL, `FullEnrich.reverseEmailLookup` (input `email`) to resolve one first. Those action
slugs and inputs are verified against the Cargo provider playbooks. Their **output paths are
not fully verified in this repository**: only `currentCompany.name`, `currentCompany.domain`,
and `currentRole.startDate` are documented upstream. Every path below marked _derive live_ is a
`PLACEHOLDER` in `infra/index.ts` and must be re-read from the live output schemas
(`cargo-ai orchestration action get-output-schema`, or the generated types after
`cargo-ai cdk types`) before the field-selection gate is presented.

| Tool output      | Template path                                      | Status                                       |
| ---------------- | -------------------------------------------------- | -------------------------------------------- |
| `person_id`      | `profile_id`                                       | derive live                                  |
| `job_title`      | `currentRole.title`                                | derive live (`currentRole` is documented)    |
| `linkedin_url`   | normalized input, or the resolver's `linkedin_url` | input-derived; resolver path: derive live    |
| `company_id`     | `currentCompany.id`                                | derive live (`currentCompany` is documented) |
| `company_name`   | `currentCompany.name`                              | documented upstream                          |
| `company_domain` | `currentCompany.domain`                            | documented upstream                          |

Present every other live `enrichProfile` output at the contact field-selection gate the same way
the company table above feeds the account gate — one row per exact provider path, with its
declared type and the routes that return it.

## Field-selection gate

Join the current provider schema above to the live CRM property schema before querying the final
target population. Derive the candidates first, then present one compact table with these columns:

| Column                    | Required evidence                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| Provider                  | Actual source system from the selected live connector and action, such as `LinkedIn`      |
| Provider property         | Exact output path, current declared type, and provider routes that return it              |
| Class                     | `starting_recommendation`, `optional_direct`, `requires_transformation`, or `unsupported` |
| CRM destination           | Recommended existing or proposed internal name and type, plus its state                   |
| Current fill              | Filled count and fill rate for the destination                                            |
| Transformation            | `none` or the exact approved conversion                                                   |
| Recommendation and reason | Include or exclude, with the compatibility and operational tradeoff                       |
| Operator decision         | `pending`, `include`, or `exclude`                                                        |

The account starting recommendation is `company_id`, `company_name`, `domain`, `website`,
`linkedin_url`,
and `employee_count`. The contact starting recommendation is the person ID, the LinkedIn profile
URL, and the job title. The provider IDs are durable matching keys. Reuse the most-filled
compatible CRM property when one exists. If none exists on HubSpot, propose the string property
(`linkedin_company_id`, `linkedin_person_id`) and include its creation in the field-contract
approval. Work email, phone, and email validation are optional contact candidates, not the
starting recommendation: each adds a paid route to the tool, phone lookups cost multiples of an
email lookup, and the gate asks whether the operator already has enrichment providers connected
before proposing new ones. Never prepend
`cargo_` to a provider-derived business property. Reserve that prefix for Cargo-owned operational
metadata such as enrichment timestamps and statuses. It is a
recommendation, not implicit approval. Include every other live LinkedIn output in the candidate
table. Use exactly one row per provider property, even when several properties share the same
compatibility decision. Each row carries its own type, route availability, destination, fill rate,
transformation, recommendation, and operator decision, and explicitly identifies the actual
provider used. Derive that name from the selected live connector and action; do not hard-code
`LinkedIn` when the adapted workflow uses another provider. Recommend direct mappings when the CRM
has a semantically equivalent property. Mark a field
`requires_transformation` when its provider and CRM shapes differ. Mark it `unsupported` when the
live provider type is absent or no safe destination or transformation exists.

Show the table and ask the operator to approve the complete field contract. This is the first
operator stop. Do not calculate the final eligible population, final credit estimate, or edit CDK
until every candidate has an `include` or `exclude` decision. Record the approved mappings and
exclusions under `field_selection` in the audit contract from
[`audit.md`](audit.md). Silence does not approve the starting recommendation.

In `infra/index.ts`, edit these together:

- `crm`: the adopted CRM connector
- `crmAccounts` / `crmContacts`: the live extractors
- `enrichCrmAccount` / `enrichCrmContact`: the write mappings, matching property, and fill-blank
  guard
- `enrichContactData`: the provider result paths marked `PLACEHOLDER`, re-read live
- `monitorCrmChampion`: the company-comparison and duplicate-search property names, the
  association write, and the alert message
- `enrichAccounts` / `enrichContacts` / `monitorChampions`: the play filter slugs, which must be
  columns on their extract — including the confirmed customer-status property on both contact
  filters
- `championAlertChannelId` and the `postMessage` input field names, confirmed against the
  generated Slack action types

The checked repository example extracts HubSpot companies and contacts (`fetchRecords`,
`objectType: "companies"` / `"contacts"`) and writes with `updateRecords` matching
`hs_object_id` and its native `skipIfExist` mapping flag. Create
`cargo_last_enriched_at` (datetime) and `cargo_enrichment_status` (string) on each enriched
object if they are missing, `primary_employment_status` (single select, `Active`/`Left`) on the
contact object, and include every creation in the field-contract approval. Keep one CRM
shape in the file. The play filter, workflow
input, and write matching property must use the same record-id field.

Two HubSpot behaviors the champion play leans on must be confirmed on the live portal at the
gate, not assumed: the company-to-contact lifecycle sync that makes `lifecyclestage = customer`
readable on the contact row, and the association model in which writing `associatedcompanyid`
moves the primary company while retaining the former company as a non-primary association. If
either does not hold, adapt the filter's customer-status source or the association step before
deploy — a portal without the sync silently gives the champion play an empty segment.

- **Salesforce:** generated Account and Contact updates matching `Id`. There is no
  `skipIfExist` — read the record first and omit any field that is already populated, including
  numeric zero. The customer-status mapping runs through
  `Contact.AccountId → Account.<customer status field>`, and preserving the former relationship
  needs an explicit step, such as an Account Contact Relationship record, confirmed against the
  generated types.
- **Attio:** generated record updates matching the record id. Same read-then-omit guard.
  Do not copy HubSpot's flag onto Attio. Attio's multi-company associations replace the
  `associatedcompanyid` write.

The checked HubSpot starting mapping is `company_id` to `linkedin_company_id`, followed by
`name`, `domain`, `website`, `linkedin_company_page`, and `numberofemployees`, plus the stamps
`cargo_last_enriched_at` and `cargo_enrichment_status`. On contacts it is the person ID to
`linkedin_person_id`, the profile URL to `linkedin_profile_url`, and the title to `jobtitle`,
plus the same stamps; the champion play additionally writes `associatedcompanyid` and
`primary_employment_status` on its job-change branch. Create the matching-key properties as
string properties only when no compatible property exists and the operator
approves the creation. Present the other provider outputs at the field-selection gate.
The provider returns `industries` as an array; most CRMs store a single enum, so inclusion requires
an approved transformation and destination.

Leave `year_founded` and provider-schema-untyped funding fields out until the live action declares
stable types.

The base template is fill-blanks only. HubSpot enforces this per property with
`skipIfExist: true`. For `enrich_accounts`, destination fill-state is not a play filter:
populated stale rows remain
eligible so an approved policy can refresh them. `enrich_contacts` differs by design: its filter
keeps a blank-destination group — the cookbook's initial-and-missing-data intent — so a fully
filled, fresh contact does not re-bill; remove that group only with an approved refresh policy.
Keep `skipIfExist` for fields approved as
fill-blanks, and remove it only for fields explicitly approved for refresh after a proposed-change
preview and an optimistic comparison against a fresh CRM read. The champion play's job-change
branch refreshes the company association, title, and employment status without `skipIfExist` —
that is its approved, recorded purpose, not a policy drift. Freshness writes only after the
provider result and CRM update.

Fetch current pricing immediately before the
preview: `cargo-ai connection integration get linkedin` for
`integration.actions.enrichCompany.credits.costs`,
`integration.actions.enrichCompanyFromDomain.credits.costs`, and
`integration.actions.enrichProfile.credits.costs`, and
`cargo-ai connection integration get FullEnrich` for
`integration.actions.reverseEmailLookup.credits.costs`. Record the lookup timestamp, CLI
version, action slugs, and unit costs in the audit. Keep the LinkedIn action first and the
fallback route — domain for accounts, the email resolver chain for contacts — mutually
exclusive.

## Complete when

- exactly one CRM model per audited object exists (`crm_accounts`, `crm_contacts` in the
  example) and each play uses its own
- every destination is an approved live CRM property
- `cargo-ai cdk types` confirms the selected CRM action names and payloads, the Slack
  `postMessage` payload, and the provider result paths this repository marks `PLACEHOLDER`
- the operator-approved field contract records every included mapping and excluded candidate
- selected provider fields and CRM destinations agree in meaning and type, or have an explicit
  approved transformation
- each managed segment trigger excludes rows with no identifier; the approved per-field policy
  decides fill blank versus refresh
- on the people path: the confirmed customer-status property drives both contact filters, the
  lifecycle-sync and association-preservation behaviors are verified on the live portal, and the
  champion alert channel is named by the operator
