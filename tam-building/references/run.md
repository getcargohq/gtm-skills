# Run

Adapt the resources after copying this folder into the consumer project. The
deploy creates two models and adopts a third; the first sync is the only
spend. Nothing in this repository deploys.

## Phase handoffs

Every message names the current phase and ends with `Next step`. A
phase-boundary handoff carries the evidence the operator needs, one concrete
approval request, what approval unlocks, and what stays blocked. An in-progress
update says `No action needed` and names the next checkpoint.

## Deploy

1. `node --import tsx evals/contract.mjs` against the adapted resources.
2. `cargo-ai cdk types`, then `cargo-ai cdk check`, then `cargo-ai cdk plan`.
   Inspect every resource and action payload.
3. Confirm the plan shows `tam_companies` with **no schedule** and
   `unification: {source: "integration"}`, the CRM companies model with the
   same unification, and `accounts` adopted with **no config**.
4. Deploy only under the sizing approval (filter, `limit`, spend).

Resolve `workspaceUuid` from `cargo-ai whoami` (`workspace.uuid`) and model
UUIDs from `cargo.state.json` or `cargo-ai storage model list`. Model links take
the form `https://app.getcargo.io/workspaces/<workspaceUuid>/models/<modelUuid>`.

## Source, once

Check before you sync: `cargo-ai storage run list --model-uuid <tamCompaniesUuid>`.
If the deploy already started a run, wait for it. A second run bills every
record again.

```sh
cargo-ai storage run create --model-uuid <tamCompaniesUuid>
cargo-ai storage run list --model-uuid <tamCompaniesUuid>
```

Watch the row count against `limit`. Rows landing well under `limit` means the
pool was smaller than counted, or a filter value matched nothing: check the
enum-backed values before widening anything.

## Unify

The report reads the unified model, and it only reflects what its last run saw.
Three syncs, in order:

1. `tam_companies` has finished (above).
2. The CRM companies model has run at least once since it was created
   (`storage run list --model-uuid <crmAccountsUuid>`). If it has not, create a
   run and wait.
3. Then refresh the unified model:

```sh
cargo-ai storage run create --model-uuid <accountsUuid>
cargo-ai storage run list --model-uuid <accountsUuid>
```

The unified model refreshes on its own schedule (every 12 hours by default).
Reading the report before this run finishes shows every sourced company as net
new, because the merge has not happened yet.

## Report

Find the table names and the SQL dialect first. Tables are
`<datasetSlug>.<modelSlug>`: `cargo-ai storage dataset list` gives the AI Ark
connector's dataset and the native one (the unified model lives in the native
dataset), and `cargo-ai storage model get-ddl <accountsUuid>` gives the dialect
and the type of the `ids` column.

Then read a few `ids` values to confirm the keys, rather than assuming them:

```sh
cargo-ai storage query execute "SELECT ids FROM <nativeDataset>.accounts LIMIT 5"
```

`ids` maps each contributing model to its record, keyed `<datasetSlug>__<modelSlug>`
(for example `ai_ark__tam_companies` and `crm__crm_accounts`). Use the keys you
actually see.

The headline, on BigQuery:

```sql
SELECT
  COUNT(*) AS tam_accounts,
  COUNTIF(JSON_QUERY(ids, '$."<crmKey>"') IS NOT NULL) AS in_crm,
  COUNTIF(JSON_QUERY(ids, '$."<crmKey>"') IS NULL) AS net_new
FROM <nativeDataset>.accounts
WHERE JSON_QUERY(ids, '$."<tamKey>"') IS NOT NULL
```

On Snowflake, the same with `COUNT_IF` and path access (`ids:"<crmKey>"`),
wrapping the column in `PARSE_JSON` if the DDL types it as a string.

The rows that could not unify, because they carry neither key:

```sql
SELECT COUNT(*) AS not_unified
FROM <aiArkDataset>.tam_companies
WHERE (domain IS NULL OR domain = '')
  AND (linkedin_url IS NULL OR linkedin_url = '')
```

And the net-new list itself, for the operator to read, passed to
`cargo-ai storage query download --query "<sql>"` (it returns a signed CSV URL):

```sql
SELECT domain, linkedin_handle, ids
FROM <nativeDataset>.accounts
WHERE JSON_QUERY(ids, '$."<tamKey>"') IS NOT NULL
  AND JSON_QUERY(ids, '$."<crmKey>"') IS NULL
```

Report:

- rows landed in `tam_companies`, against `limit` and against the counted pool
- unified TAM accounts (fewer than rows landed when AI Ark returned the same
  company twice)
- already in the CRM, and net new, as counts and as a share
- rows that could not unify
- estimated credits, actual credits (`cargo-ai billing usage get-metrics`), and
  the variance, with the pricing lookup time
- direct Cargo links for the three models

Spot-check before you send it: pick three accounts counted as in the CRM and
three counted as net new, and look each one up in the CRM by domain. A net-new
account that is in the CRM under a different website is the signal that the
merge rules (see `configure.md`) are missing it.

## Next steps

End the report with the two decisions on the net-new accounts, and nothing
else:

1. **Create them in the CRM?** This skill writes nothing to the CRM. On a yes,
   the net-new list goes to the project's CRM write path under its own
   approval: a reviewed sample first, then a batch through the CRM connector's
   `upsertRecords` keyed on domain, so a company that appeared since the report
   is updated rather than duplicated.
2. **Enrich them in a dedicated play?** Once they are in the CRM,
   `crm-enrichment` keeps them filled. Before that, name which fields the
   operator needs that AI Ark did not return, and price the enrichment on the
   net-new count.

A large net-new share is not automatically good news. Read it against the
ICP: if most net-new accounts sit at the edge of the headcount band or in one
industry, the filter is wider than the market the company actually works, and
narrowing it is free.

## Complete when

- the plan showed `tam_companies` unscheduled and `accounts` adopted with no
  config before anything was sourced
- exactly one sourcing run happened for the approved `limit`
- the unified model was refreshed after both source models had synced
- `in_crm + net_new = tam_accounts`, and `not_unified` is reported beside them
- three in-CRM and three net-new accounts were spot-checked against the CRM
- no CRM record was created or updated
- no credential, customer data, or deploy command was written into the copied
  template
