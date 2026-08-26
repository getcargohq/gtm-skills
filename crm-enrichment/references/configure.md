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

In `infra/index.ts`, edit these together:

- `crm`: the adopted CRM connector
- `crmAccounts`: the live account extractor
- `enrichCrmAccount`: the write mappings, matching property, and fill-blank guard
- `enrichAccounts`: the play filter slugs, which must be columns on `crm_accounts`

The checked repository example extracts HubSpot companies (`fetchRecords`,
`objectType: "companies"`) and writes with `updateRecords` matching
`hs_object_id` and its native `skipIfExist` mapping flag. Create
`cargo_last_enriched_at` and `cargo_enrichment_status` on the company object if
they are missing. Keep one CRM shape in the file. The play filter, workflow
input, and write matching property must use the same record-id field.

- **Salesforce:** generated Account update matching `Id`. There is no `skipIfExist` — read the
  Account first and omit any field that is already populated, including numeric zero.
- **Attio:** generated company-record update matching the record id. Same read-then-omit guard.
  Do not copy HubSpot's flag onto Attio.

The checked HubSpot write mapping is `name`, `domain`, `website`, `linkedin_company_page`, and
`numberofemployees`, plus the stamps `cargo_last_enriched_at` and `cargo_enrichment_status`.
Leave LinkedIn `company_id` and industry out of the base mapping. The provider returns
`industries` as an array; most CRMs store a single enum. Add industry only as the
`selected_fields` variation after the live types agree.

Leave `year_founded` and provider-schema-untyped funding fields out until the live action declares
stable types.

The base template is fill-blanks only. HubSpot enforces this per property with
`skipIfExist: true`. The play filter skips the paid call when domain, LinkedIn URL, and employee
count are already populated (`skipped_already_filled`). Freshness writes only on the `written`
path. Refreshing populated fields requires a separate field-level approval, a proposed-change
preview, and an optimistic comparison against a fresh CRM read.

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
- selected provider fields and CRM destinations agree in meaning and type
- the workflow exits before a paid call when identifiers are missing or the approved
  destinations are already filled
