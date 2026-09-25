# Configure

Everything between reading the context and asking the operator to approve a
filter. The only paid calls in this file are the research calls in step 2, and
they run only when no ICP is written down, after a yes.

## Reconcile before you edit

Reuse what the project already declares: an AI Ark connector, a CRM connector,
a companies extract of that CRM (`crm-enrichment` ships one as `crm_accounts`),
the unified `accounts` model, and TAM-building folders. Two resources with one
slug collide at deploy. Two extracts of the same CRM object are worse: both
unify, and every CRM company counts twice in the report.

`cargo-ai storage model list` shows what the workspace already holds. A
`native` model with extractor `unifyAccounts` is the unified accounts model;
note its UUID, you will read its config below.

This skill declares no `defineContext`: that resource is a **per-workspace
singleton** owned by the project (a scaffolded repo points it at the root
`context/`).

## 1. Read the ICP before you research one

Look in the workspace context repository for anything that already defines who
the company sells to: `icp.md`, a scoring rubric, the ICP files
`account-scoring` reads, a positioning doc. If one exists, show it to the
operator as the definition and move to sizing once they confirm it still holds.

Do not rewrite an ICP someone already wrote. If it is thin (no headcount band,
no disqualifiers), say which lines are missing and ask only for those.

## 2. Research the market when nothing is written

Three sources, in this order, each feeding the next:

| Source                        | What to read                                                                                       | Action                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| The company's website         | Homepage, product and pricing pages: who they say the product is for, and which problems they name | `parallel.extract` on the URLs, with that objective                |
| Customer stories              | The customers page and case studies: named customers, and what each bought the product to fix      | `parallel.extract` on the case-study URLs                          |
| The customers' LinkedIn pages | Industry, headcount band, headquarters, specialties, for each named customer                       | `linkedin.enrichCompanyFromDomain`, one record per customer domain |

```sh
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"parallel","actionSlug":"extract","config":{}}' \
  --records '[{"urls":["https://acme.com","https://acme.com/customers"],"objective":"Who the product is for, which problems it names, and which customers it names"}]' \
  --wait-until-finished

cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"linkedin","actionSlug":"enrichCompanyFromDomain","config":{}}' \
  --records '[{"domain":"customer-one.com"},{"domain":"customer-two.com"}]' \
  --wait-until-finished
```

Before running either, fetch the live prices
(`cargo-ai connection integration get parallel`,
`cargo-ai connection integration get linkedin`), state the total for the
number of pages and customers you plan to read, and get a yes. Keep the
customer list to the ones the site names; a customer you guessed is not
evidence.

Then write the draft `context/icp.md` from what the customers share, using
`infra/context/icp.md` as the shape: who buys, where it came from, the
firmographics (each mapped to a filter group), the disqualifiers. Mark any line
no customer supports as a hypothesis. The operator corrects it, and the
corrected file is what gets approved.

Keep the customer domains. They are the seeds for the `lookalike-sourcing`
variation, and offering it is part of this step.

## 3. Filter groups, not a flat map

`fetchCompanies` and `countCompanies` take the same shape: **nested groups**,
each one config key holding suffixed sub-keys.

| Group                                                                                                                                                                                                      | What it constrains                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `companyInfo`                                                                                                                                                                                              | `domain_or`, `name_or`, `linkedin_url_or`                              |
| `industry`                                                                                                                                                                                                 | `industry_or` / `industry_not`, enum-backed                            |
| `employeeSize`                                                                                                                                                                                             | `min_employee_count`, `max_employee_count`, numbers                    |
| `companyType`                                                                                                                                                                                              | `company_type_or`, for example privately held or public                |
| `employeeRole`                                                                                                                                                                                             | `employee_title_or`, the persona the company already employs           |
| `technologies`                                                                                                                                                                                             | the stack a company runs                                               |
| `funding`                                                                                                                                                                                                  | `funding_type` (enum-backed), `min_total_funding`, `max_total_funding` |
| `companyLocation`, `companyKeywords`, `productAndServices`, `naics`, `annualRevenue`, `foundedYear`, `locationCount`, `headcountGrowth`, `employeeByDepartment`, `operationLanguage`, `companySocialMedia` | the rest of the surface                                                |

Conventions inside a group:

- **`_or` includes, `_not` excludes.** Every one takes a string or an array.
  Each disqualifier in `icp.md` that AI Ark has a field for becomes a `_not`,
  so it is never sourced or paid for.
- **Enum-backed fields come from autocompletes.** `industry`, seniority,
  department, funding type and language must be valid members. Resolve them with
  `listIndustries`, `listSeniorities`, `listDepartmentsAndFunctions`,
  `listCompanyDepartments`, `listFundingTypes`, `listLanguages`. A guessed label
  matches nothing and returns an empty sync that reads like a broken connector.
- **Numeric ranges are numbers**, not stringified numbers.
- **A flat map expresses nothing.** `{"industry": "Software"}` at the top level
  is ignored, silently, and you source the whole database up to `limit`.

`employeeRole` is worth reaching for early. "The company already employs the
persona" is usually the sharpest single ICP signal available at sourcing time,
and applying it in the filter is free.

## 4. The count-first gate

`aiArk.countCompanies` takes exactly the filter groups above, minus `limit`,
returns `{"count": N}`, and is **free**:

```sh
cargo-ai orchestration action execute --wait-until-finished \
  --action '{"kind":"connector","integrationSlug":"aiArk","actionSlug":"countCompanies","config":{}}' \
  --data '{
    "industry": {"industry_or": ["software development"]},
    "employeeSize": {"min_employee_count": 20, "max_employee_count": 500},
    "employeeRole": {"employee_title_or": ["Revenue Operations"]}
  }'
```

Counting is design-time work, so it stays a CLI call rather than a deployed
resource: a resource that only ever wraps one connector action is ceremony, and
the count has to happen while the filter is still being argued about.

Count every candidate, not just the final one. The useful output of this phase
is a small table the operator can read a decision off:

| Filter                  | Count | What it changes                                 |
| ----------------------- | ----- | ----------------------------------------------- |
| Industries only         | …     | the ceiling                                     |
| plus the headcount band | …     | how much of the ceiling the ICP actually claims |
| plus `employeeRole`     | …     | how many already employ the persona             |
| the proposed filter     | …     | what `limit` is a fraction of                   |

## 5. Read the merge rules, do not write them

```sh
cargo-ai storage model get <accountsUuid>
```

The unified model's config holds one strength per reference. The skill relies
on two of them:

| Reference    | Needs to be | Why                                                                                   |
| ------------ | ----------- | ------------------------------------------------------------------------------------- |
| `domain`     | `strong`    | The website is the key AI Ark and the CRM both carry most often                       |
| `linkedinId` | `strong`    | Catches the CRM companies whose website is blank or different from the sourced domain |

Those are the platform defaults. If the live config differs, do not change it
from this skill: the same config decides merges for every source in the
workspace. Tell the operator what the in-CRM count will miss and who owns the
change (`linkedin-handle-merges` in `SKILL.md` is the common one).

AI Ark returns no Crunchbase field. `crunchbaseUuid` still merges when another
source carries it, but no sourced row will ever match on it, so do not promise
a Crunchbase match.

## Prices

Immediately before any preview, run `cargo-ai connection integration get aiArk`
and read the current `fetchCompanies` entry under `credits.costs`. Record the
CLI version, the lookup time, the extractor slug, and the unit price alongside
the estimate, so the post-run variance is checkable against something.

Do not write a price into any file in this skill. Prices change; a number
committed to markdown goes stale silently and gets quoted to an operator months
later.

## The approval

Present the counted pool, `limit` against it, the live unit price, the estimate,
and any gap in the merge rules. Stop for approval of the filter, the `limit`
and that maximum spend together: narrowing the filter and lowering the budget
are the same lever pulled in different places. That approval covers the deploy
and the first sync.

## What to edit, together

In `infra/models/tam-companies.ts`:

- `config`: the filter groups and `limit`
- keep `unification: { source: "integration" }` and no `schedule`

In `infra/models/crm-accounts.ts` (or the project's existing extract):

- the connector and `config.objectType` for a CRM other than HubSpot

In `infra/models/accounts.ts`:

- nothing. It is adopted as it is.

In the project's `context/`:

- `icp.md`, in the operator's own language

## Complete when

- the ICP came from the context repo, or was researched with approved spend and
  written to `context/icp.md`
- every filter group is nested and every enum-backed value came from an
  autocomplete
- `countCompanies` was run for each candidate filter and the numbers are recorded
- `limit` is at or below the counted pool and the operator has seen the estimate
- the unified model's `domain` and `linkedinId` strengths were read, and any
  gap was reported rather than fixed
