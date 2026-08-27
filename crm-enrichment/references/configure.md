# Configure

Reuse the consumer's CRM connector and account extract when they exist. If a
HubSpot companies model (or the Salesforce Accounts / Attio equivalent) is
already declared, import it as `crm_accounts` and drop the copy. Two extracts
of the same object collide at deploy. The play runs on that extract. There is
no native `accounts` unification in this skill.

Re-read the live provider and CRM actions before editing the template. These are LinkedIn
output paths, not CRM destinations. They were verified on 2026-08-21. Treat current live
schemas as authoritative.

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

The starting recommendation is `company_id`, `company_name`, `domain`, `website`, `linkedin_url`,
and `employee_count`. LinkedIn `company_id` is a durable matching key. Reuse the most-filled
compatible CRM property when one exists. If none exists on HubSpot, propose the string property
`linkedin_company_id` and include its creation in the field-contract approval. Never prepend
`cargo_` to a proposed CRM property. It is a
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
- `crmAccounts`: the live account extractor
- `enrichCrmAccount`: the write mappings, matching property, and fill-blank guard
- `enrichAccounts`: the play filter slugs, which must be columns on `crm_accounts`

The checked repository example extracts HubSpot companies (`fetchRecords`,
`objectType: "companies"`) and writes with `updateRecords` matching
`hs_object_id` and its native `skipIfExist` mapping flag. Create
`last_enriched_at` and `enrichment_status` on the company object if
they are missing. Keep one CRM shape in the file. The play filter, workflow
input, and write matching property must use the same record-id field.

- **Salesforce:** generated Account update matching `Id`. There is no `skipIfExist` — read the
  Account first and omit any field that is already populated, including numeric zero.
- **Attio:** generated company-record update matching the record id. Same read-then-omit guard.
  Do not copy HubSpot's flag onto Attio.

The checked HubSpot starting mapping is `company_id` to `linkedin_company_id`, followed by
`name`, `domain`, `website`, `linkedin_company_page`, and `numberofemployees`, plus the stamps
`last_enriched_at` and `enrichment_status`. Create `linkedin_company_id` as a
string property only when no compatible LinkedIn company ID property exists and the operator
approves its creation. Present industry and the other provider outputs at the field-selection gate.
The provider returns `industries` as an array; most CRMs store a single enum, so inclusion requires
an approved transformation and destination.

Leave `year_founded` and provider-schema-untyped funding fields out until the live action declares
stable types.

The base template is fill-blanks only. HubSpot enforces this per property with
`skipIfExist: true`. Destination fill-state is not a play filter: populated stale rows remain
eligible so an approved policy can refresh them. Keep `skipIfExist` for fields approved as
fill-blanks, and remove it only for fields explicitly approved for refresh after a proposed-change
preview and an optimistic comparison against a fresh CRM read. Freshness writes only after the
provider result and CRM update.

Fetch current pricing with `cargo-ai connection integration get linkedin` immediately before the
preview. Read the applicable entries under
`integration.actions.enrichCompany.credits.costs` and
`integration.actions.enrichCompanyFromDomain.credits.costs`. Record the lookup timestamp, CLI
version, action slugs, and unit costs in the audit. Keep the LinkedIn action first and the domain
action as the mutually exclusive fallback.

## Complete when

- exactly one CRM account model exists (`crm_accounts` in the example) and the play uses it
- every destination is an approved live CRM property
- `cargo-ai cdk types` confirms the selected CRM action names and payloads
- the operator-approved field contract records every included mapping and excluded candidate
- selected provider fields and CRM destinations agree in meaning and type, or have an explicit
  approved transformation
- the managed segment trigger excludes rows with no identifier but allows populated stale rows;
  the approved per-field policy decides fill blank versus refresh
