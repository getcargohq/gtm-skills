# Configure

Everything between reading the ICP and asking the operator to approve a filter.
No paid call happens anywhere in this file.

## Reconcile before you edit

Reuse what the project already declares. An AI Ark connector, an LLM connector,
and TAM-building folders: two resources with one slug collide at deploy. This
skill declares no `defineContext`: that resource is a **per-workspace
singleton** owned by the project (a scaffolded repo points it at the root
`context/`). Copy `infra/context/*.md` into that directory. The agent's
`context` capability reads whatever the workspace context holds, wherever it
was declared.

If the project already has an `accounts` model that scoring, routing, and
signals read, do not rename `tam_companies` to it. Land the sourced rows here and
add the promotion play described under `promote-to-shared-accounts` in
`SKILL.md`, so the landing table and the shared universe stay separable.

## The ICP comes from the context repo

Read it before asking for it. The workspace context repository is where an ICP
already lives if the company has written one down, and the whole point of this
skill's rubric design is that both files are readable by the operator and by the
agent. Ask only when nothing is written anywhere, and then write the answer into the
project's `context/icp.md` rather than into a prompt. `infra/context/icp.md` is
the example to copy there.

Two files, and they do different jobs:

| File                | What it holds                                                                                | Who reads it                                             |
| ------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `icp.md`            | Who buys, the firmographics, the disqualifiers, what "already running the motion" looks like | The agent on every judgment; the operator when it drifts |
| `tiering-rubric.md` | What A, B, C and disqualified mean, and what evidence may decide each                        | The agent on every judgment; the rep reading a tier      |

The disqualifiers in `icp.md` must be stated as disqualifiers, not as low
scores. A disqualifier ends the evaluation; a low score competes with the other
signals and loses to a strong one.

## Filter groups, not a flat map

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
and applying it in the filter is free, while discovering the persona is absent
costs a sourced record and an agent run.

## The count-first gate

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

Then present `limit` against that last number and say plainly what the first run
will cost. Stop for approval of the filter, the `limit`, and the rubric together:
they are one decision, because narrowing the filter and lowering the budget are
the same lever pulled in different places.

## Prices

Immediately before any preview, run `cargo-ai connection integration get aiArk`
and read the current entry under
`integration.actions.searchCompanies.credits.costs`; the `fetchCompanies`
extractor bills on the same per-record basis. Record the CLI version, the lookup
time, the action slug, and the unit price alongside the estimate, so the
post-run variance is checkable against something.

Do not write a price into any file in this skill. Prices change; a number
committed to markdown goes stale silently and gets quoted to an operator months
later.

## What to edit, together

In `infra/models/tam-companies.ts`:

- `config`: the filter groups and `limit`
- `additionalColumns`: keep `tier`, `tier_rationale`, `tier_evidence_url` and
  `tiered_at`; add to them only if the play writes them on the same node

In the project's `context/` (copy from `infra/context/`):

- `icp.md` and `tiering-rubric.md`, in the operator's own language

In `infra/agents/tier-analyst.ts`:

- `languageModel`, and the JSON schema's `tier` enum if the rubric uses
  different tier names. The enum and the segments in `infra/segments/tiers.ts`
  must agree, or the tiers land as values nothing matches

In `infra/plays/tier-companies.ts`:

- the workflow `input`, against the extractor's real column names. Confirm them
  with `cargo-ai storage column list` after the first sync rather than trusting
  the example: a renamed column leaves the prompt describing an undefined, and
  the agent tiers a company it was told nothing about

## Complete when

- the ICP and the rubric are written in the context repo, not in a prompt
- every filter group is nested and every enum-backed value came from an
  autocomplete
- `countCompanies` was run for each candidate filter and the numbers are recorded
- `limit` is at or below the counted pool and the operator has seen the estimate
- the tier enum, the rubric's tier names, and the segments all use the same
  values
