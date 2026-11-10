# Run

Deploy, then process one source at a time, then report. **Deploying a source
model starts its first sync**: that is the sourcing spend, and it is what the
budget approval covers. The plays ship disabled, so nothing is enriched or
classified until you run them, one source at a time.

## Phase handoffs

Every message names the current phase and ends with `Next step`. A phase
boundary carries the evidence, one concrete approval request, what it unlocks
and what stays blocked. An in-progress update says `No action needed` and names
the next checkpoint.

## Deploy

1. `node --import tsx evals/contract.mjs` from this skill's folder, against the
   adapted resources.
2. `cargo-ai project types`, then `cargo-ai project check`, then
   `cargo-ai project plan`. Confirm the plan shows the five connectors, the
   source models with **no schedule**, `tam_universe`, the two tools and the
   four plays **disabled**.
3. Deploy only under the budget approval.

Resolve `workspaceUuid` from `cargo-ai whoami` and each UUID from
`cargo.state.json`. A model link is
`https://app.getcargo.io/workspaces/<workspaceUuid>/models/<modelUuid>`.

## Source, one at a time

**One source at a time, in order: Sales Navigator, AI Ark, Apollo, Exa.** The
unify tool recognises a company the TAM already holds before it pays to enrich
it, but a native write takes minutes to be readable. Two sources running at
once both miss each other's fresh rows, enrich the same company twice, and
leave a duplicate. One after another, the overlap is caught for free.

For each paid source:

1. Confirm the deploy's sync finished and landed rows:
   `cargo-ai storage run list --model-uuid <uuid>`. Do not start a second
   one: it bills every record again.
2. Pilot five rows through the play's workflow, and read the five
   `tam_universe` rows they wrote: category, status, reason, `in_crm`. A wrong
   category here is a wrong category on every row.

   ```sh
   cargo-ai orchestration batch create --workflow-uuid <playWorkflowUuid> \
     --data '{"kind":"filter","modelUuid":"<sourceModelUuid>","limit":5}' \
     --wait-until-finished
   ```

3. Run the rest the same way without `limit`, or enable the play and let its
   hourly tick take them. `changeKinds: ["added"]` does not backfill rows that
   were already there while the play was off, so the first pass is the batch.
4. Wait until no row of that source has an empty `unified_at`, then move to the
   next source.

Exa last: insert the queries into `tam_exa_queries` (one row each, with
`cargo-ai storage record create`), then **wait until they are readable**
(`SELECT COUNT(*) FROM object.tam_exa_queries` shows them, a few minutes): a
batch or a play started before that sees no rows and does nothing. Then run
`tam_search_exa` the same way.

**Native writes are read back late.** A row written into `tam_universe` can
take minutes to appear in SQL. Read the report a few minutes after the last
batch, not right after it.

**A sync replaces a source model's rows.** Re-syncing with a narrower filter
drops the companies it no longer returns from the source model. The TAM keeps
them: `tam_universe` is only ever added to or flagged.

## Report

Confirm the table name and the SQL dialect first:
`cargo-ai storage model get-ddl <tamUniverseUuid>` gives both. Native custom
models live in the `object` dataset (`object.tam_universe`); the queries below
write it as `<native>.tam_universe`.

**The funnel.** What the sources returned against what counts:

```sql
SELECT status, COUNT(*) AS companies
FROM <native>.tam_universe
GROUP BY status
ORDER BY companies DESC
```

**Net new against the CRM.** The number the operator acts on:

```sql
SELECT
  COUNTIF(status = 'in_scope') AS tam,
  COUNTIF(status = 'in_scope' AND in_crm) AS already_in_crm,
  COUNTIF(status = 'in_scope' AND NOT IFNULL(in_crm, FALSE)) AS net_new
FROM <native>.tam_universe
```

**What each source added.** Found, found by no other source, and added in
this order. Read the first two together: "found by no other source" does not
depend on the order, and it is what you would lose by dropping the source.

```sql
SELECT
  COUNTIF(found_by_sales_navigator) AS sales_navigator_found,
  COUNTIF(found_by_sales_navigator AND NOT IFNULL(found_by_ai_ark, FALSE) AND NOT IFNULL(found_by_apollo, FALSE) AND NOT IFNULL(found_by_exa, FALSE)) AS sales_navigator_only,
  COUNTIF(found_by_ai_ark) AS ai_ark_found,
  COUNTIF(found_by_ai_ark AND NOT IFNULL(found_by_sales_navigator, FALSE) AND NOT IFNULL(found_by_apollo, FALSE) AND NOT IFNULL(found_by_exa, FALSE)) AS ai_ark_only,
  COUNTIF(found_by_apollo) AS apollo_found,
  COUNTIF(found_by_apollo AND NOT IFNULL(found_by_sales_navigator, FALSE) AND NOT IFNULL(found_by_ai_ark, FALSE) AND NOT IFNULL(found_by_exa, FALSE)) AS apollo_only,
  COUNTIF(found_by_exa) AS exa_found,
  COUNTIF(found_by_exa AND NOT IFNULL(found_by_sales_navigator, FALSE) AND NOT IFNULL(found_by_ai_ark, FALSE) AND NOT IFNULL(found_by_apollo, FALSE)) AS exa_only
FROM <native>.tam_universe
WHERE status = 'in_scope'
```

```sql
SELECT first_source, COUNT(*) AS added
FROM <native>.tam_universe
WHERE status = 'in_scope'
GROUP BY first_source
```

**What each source returned that was not your market.** Read it as each
source's noise, not as a ranking:

```sql
SELECT first_source, exclusion_reason, COUNT(*) AS companies
FROM <native>.tam_universe
WHERE status != 'in_scope'
GROUP BY first_source, exclusion_reason
ORDER BY first_source, companies DESC
```

**The coverage estimate.** You cannot count the companies no source found, but
two lists built independently estimate them: if Sales Navigator found 73% of
the companies Apollo found, it probably found about 73% of the market. The
formula is `market ≈ found by A × found by B ÷ found by both`
(capture-recapture, the method ecologists use to count fish).

```sql
SELECT
  COUNTIF(found_by_sales_navigator) AS a,
  COUNTIF(found_by_apollo) AS b,
  COUNTIF(found_by_sales_navigator AND found_by_apollo) AS both_lists,
  SAFE_DIVIDE(COUNTIF(found_by_sales_navigator) * COUNTIF(found_by_apollo),
              COUNTIF(found_by_sales_navigator AND found_by_apollo)) AS estimated_market
FROM <native>.tam_universe
WHERE status = 'in_scope'
```

Sales Navigator and Apollo are the pair because both are census searches of
the same brief in different databases. AI Ark (seeded by your customers) and
Exa (written queries) are not trying to enumerate the market, so they would
skew it. Report it as a floor: both lists favour companies that are easy to
see, and the hidden ones are hidden from both. Then coverage is
`tam ÷ estimated_market`. Below a few hundred companies in the overlap, say
the estimate is too thin to quote.

**How many sources found each company.** Companies several sources agree on
are, in our own build, more often the accounts you want. Keep the split for
`account-scoring`:

```sql
SELECT
  CAST(IFNULL(found_by_sales_navigator, FALSE) AS INT64)
  + CAST(IFNULL(found_by_ai_ark, FALSE) AS INT64)
  + CAST(IFNULL(found_by_apollo, FALSE) AS INT64)
  + CAST(IFNULL(found_by_exa, FALSE) AS INT64) AS sources,
  COUNT(*) AS companies
FROM <native>.tam_universe
WHERE status = 'in_scope'
GROUP BY sources
ORDER BY sources
```

The report gives, in this order:

- the headline: "N companies in your TAM, X net new, Y already in your CRM"
- the funnel by status, and the exclusion reasons by source
- per source: found, found by no other source, added in order
- the coverage estimate with its floor caveat, or why it is too thin
- the split by number of sources
- actual credits against the estimate (`cargo-ai billing usage get-metrics`),
  with the pricing lookup time
- the links to `tam_universe` and the four sources

## Openings

End by offering what can be built on the TAM, and recommend one:

| Opening                 | What the operator gets                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------- |
| **Score it**            | `account-scoring` tiers the in-scope rows; compare the tiers by number of sources      |
| **Push the net new**    | The net-new accounts created in the CRM: a write the operator approves on its own, with a reviewed sample first. Never a side effect of this skill |
| **Enrich**              | `crm-enrichment` once the accounts are in the CRM                                      |
| **Review the gaps**     | The `needs_review` rows (thin pages, missing size or country), read by a person         |

## Complete when

- the plan showed the sources unscheduled and the plays disabled before
  anything was sourced
- each source was synced once and processed before the next one started
- the report gives the headline with net new and already in the CRM, the
  per-source table, the coverage estimate or why it is too thin, and actual
  credits against the estimate
- the report ended on the openings, with one recommended
- nothing was written to the CRM
