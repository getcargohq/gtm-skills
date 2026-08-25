# Configure account enrichment

Re-read the live provider and CRM actions before editing the template. The LinkedIn paths below
were verified on 2026-08-21. Treat current live schemas as authoritative.

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

In `infra/account-enrichment.ts`, edit these together:

- `crm`: the adopted CRM connector
- `crmAccounts`: the live extractor and Account object configuration
- `crmSourceKey`: the exact CRM key observed in the unified Account `ids` map
- `crmFields`: exact approved destination properties
- `enrichAccountWorkflow`: the CRM record-write payload and fill-blank guard
- `accounts`: the source-ID computed column and CRM freshness lookup

The checked repository example uses HubSpot's `updateRecords` action and its native
`skipIfExist` mapping flag. For Salesforce or Attio, replace that action from generated consumer
types. Use an equivalent conditional update when available. Otherwise add a fresh CRM read and
preserve populated values explicitly. Do not keep inactive CRM branches in the file.

Leave `year_founded` and provider-schema-untyped funding fields out until the live action declares
stable types.

The base template is fill-blanks only. HubSpot enforces this per property with
`skipIfExist: true`, which preserves populated values without depending on the untyped
`getRecord` output. Refreshing populated fields requires a separate field-level approval, a
proposed-change preview, and an optimistic comparison against a fresh CRM read.

Fetch current pricing with `cargo-ai connection integration get linkedin` immediately before the
preview. Read the applicable entries under
`integration.actions.enrichCompany.credits.costs` and
`integration.actions.enrichCompanyFromDomain.credits.costs`. Record the lookup timestamp, CLI
version, action slugs, and unit costs in the audit. Keep the LinkedIn action first and the domain
action as the mutually exclusive fallback.

## Complete when

- every placeholder has an approved live CRM destination
- `cargo-ai cdk types` confirms the selected CRM action names and payloads
- selected provider fields and CRM destinations agree in meaning and type
- the tool exits before a paid call while any placeholder remains
