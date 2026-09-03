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

### Person action (people path)

The contact tool calls `linkedin.enrichProfile` (input `linkedinUrl`). Its output schema is
**flat**, verified live on 2026-09-03 — do not reuse the nested `currentCompany.*` /
`currentRole.*` shapes some upstream recipes still show. The paths the template maps:

| Group           | Exact output paths                                                                                                   | Declared type                                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Person          | `profile_id`, `public_id`, `urn`, `full_name`, `first_name`, `last_name`, `headline`, `job_title`, `linkedin_url`    | string                                                                                                                                                                                 |
| Current company | `company`, `company_domain`, `company_website`, `company_linkedin_url`, `company_industry`, `company_employee_range` | string                                                                                                                                                                                 |
| Current company | `company_employee_count`, `company_year_founded`, `current_company_join_month`, `current_company_join_year`          | number                                                                                                                                                                                 |
| Location        | `city`, `state`, `country`, `location`                                                                               | string                                                                                                                                                                                 |
| History         | `experiences`                                                                                                        | array of objects with `company`, `company_id`, `company_linkedin_url`, `title`, `is_current`, `start_month`, `start_year`, `end_month`, `end_year`, `date_range`, `duration`, and more |
| History         | `educations`, `skills`, `languages`                                                                                  | arrays                                                                                                                                                                                 |

The tool maps `profile_id`, `job_title`, `linkedin_url`, `company` → `company_name`,
`company_domain`, and `company_linkedin_url`, and passes the whole payload as `profile_json` for
the champion verdict — the `experiences` array with its `is_current` flags and dates is what
lets the verdict see through concurrent positions. Present every other live output at the
contact field-selection gate the same way the company table above feeds the account gate — one
row per exact provider path, with its declared type.

### Email resolver (people path)

A row without a profile URL resolves one first through Cargo's **"Find LinkedIn URL from
email" template tool** — an internal waterfall priced per resolved row — then continues into
`linkedin.enrichProfile`. Instantiate it from the template catalog in the workspace UI, paste
its UUID into `findLinkedinUrlFromEmail` in `infra/index.ts`, and confirm its output path (the
template assumes `linkedin_url`) on the instantiated tool's release before deploying. Do not
swap in a direct provider reverse-lookup node: the template tool is the maintained, cheaper
route.

### Create the CRM properties by hand (people path)

The HubSpot connector has no create-property action, so approved property creation is an
explicit UI step in the audit phase, before the write probe. Three rules, each a silent or
row-dropping failure when broken: internal names are frozen at creation and must match the
template verbatim; enum option values are case-sensitive (`Active`/`Left`, exactly); date
properties must be "Date picker — **date and time**" — a date-only property rejects timestamp
writes with `INVALID_DATE`, and because HubSpot updates are atomic the whole row's mapping
drops with it. A date property cannot be converted to datetime in place; delete and recreate
it. The checked people-path list on contacts: `linkedin_person_id` (single-line text),
`linkedin_profile_url` (single-line text), `primary_employment_status` (single select,
options `Active` and `Left`), `cargo_last_enriched_at` (date and time),
`cargo_enrichment_status` (single-line text). The account path's `cargo_last_enriched_at` and
`cargo_enrichment_status` on companies follow the same date-and-time rule.

### Declare or adopt the relationship (people path)

Both contact play filters read the account's customer property through the
`contact_primary_company` relationship (`crm_accounts.hs_object_id` one-to-many
`crm_contacts.associatedcompanyid`). **List the dataset's existing relationships first**: if an
identical one already exists, adopt it into CDK state instead of creating a second. A dataset's
relationship set is replaced wholesale on deploy — always send the full array, or an unrelated
existing relationship silently disappears.

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
- `contactPrimaryCompany`: the relationship columns, or the adopted existing relationship
- `enrichCrmAccount` / `enrichCrmContact`: the write mappings, matching property, and fill-blank
  guard
- `findLinkedinUrlFromEmail`: the instantiated template tool's UUID and its output path
- `monitorCrmChampion`: the company-comparison and duplicate-search property names, the
  find-or-create identifiers, the note body, and the alert message
- `championVerdictWorkflow`: the verdict prompt, if the operator's definition of a move differs
- `contactToCompanyTypeId` / `noteToContactTypeId` / `noteToCompanyTypeId`: verified against the
  live connector's association-type autocomplete
- `enrichAccounts` / `enrichContacts` / `monitorChampions`: the play filter slugs, which must be
  columns on their extract or the related account model — including the confirmed
  customer-status property on both contact filters
- `championAlertChannelId`: the approved channel, with the Cargo app already added to it

The checked repository example extracts HubSpot companies and contacts (`fetchRecords`,
`objectType: "companies"` / `"contacts"`) and writes with `updateRecords` matching
`hs_object_id` and its native `skipIfExist` mapping flag, creates the missing company with
`insertRecord`, preserves and adds associations with `createAssociation`, and posts the alert
with the live Slack payload — `channelId`, `format: "markdown"`, `body` (verified 2026-09-03; a
`message` field does not exist and dies at the alert step, after the paid call). Create the
approved properties by hand per the UI step above and include every creation in the
field-contract approval. Keep one CRM
shape in the file. The play filter, workflow
input, and write matching property must use the same record-id field.

One HubSpot behavior the champion play leans on must be confirmed on the live portal at the
gate, not assumed: writing `associatedcompanyid`
moves the primary company. The former relationship does not depend on implicit retention — the
play preserves it with an explicit `createAssociation` — but the three association type ids
(the checked example ships HubSpot-defined `279`, `202`, `190`) must be verified against the
connector's association autocomplete before deploy.

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
`integration.actions.enrichProfile.credits.costs`, plus the instantiated resolver tool's live
per-row quote. Record the lookup timestamp, CLI
version, action slugs, and unit costs in the audit. Keep the LinkedIn action first and the
fallback route — domain for accounts, the email resolver chain for contacts — mutually
exclusive.

Toolchain: pin the consumer project's root `zod` to `4.4.3` — a version mismatch against the
CDK breaks typechecking — and run `tsc` against generated workspace types with
`NODE_OPTIONS=--max-old-space-size=16384`, in CI too.

## Complete when

- exactly one CRM model per audited object exists (`crm_accounts`, `crm_contacts` in the
  example) and each play uses its own; the `contact_primary_company` relationship is declared or
  adopted, with the dataset's full relationship array sent
- every destination is an approved live CRM property, created by hand per the UI step where
  missing — verbatim internal names, case-sensitive enum options, date-and-time date properties
- `cargo-ai cdk types` confirms the selected CRM action names and payloads, and the resolver
  tool's UUID, output path, and the association type ids this repository marks `PLACEHOLDER`
  are resolved from the live workspace
- the operator-approved field contract records every included mapping and excluded candidate
- selected provider fields and CRM destinations agree in meaning and type, or have an explicit
  approved transformation
- each managed segment trigger excludes rows with no identifier, and every blank condition pairs
  `isNull` with `isEmpty`; the approved per-field policy
  decides fill blank versus refresh
- on the people path: the confirmed customer-status property drives both contact filters through
  the relationship, the `associatedcompanyid` primary-move behavior is verified on the live
  portal, and the
  champion alert channel is named by the operator with the Cargo app added
