# Sources

Four sources, because none of them is your market on its own. Each one gets
the same brief and searches it its own way, and that difference is the point:
a company filed under the wrong industry, ranked too low, or missing from one
database is found by another.

| Source          | Its job                              | Model or play                                       | Identifier it returns     |
| --------------- | ------------------------------------ | --------------------------------------------------- | ------------------------- |
| Sales Navigator | The census: every company LinkedIn files under your filters | `tam_source_sales_navigator` (`fetchAccountSearch`) | the LinkedIn company id   |
| AI Ark          | Lookalikes of the customers you name | `tam_source_ai_ark` (`fetchCompanies`)              | LinkedIn URL and domain   |
| Apollo          | The second census, a different database | `tam_source_apollo` (`fetchOrganizations`)       | LinkedIn URL and domain   |
| Exa             | Search by meaning: what the website says the company does | `tam_exa_queries` + the `tam_search_exa` play | a website only |

Every source runs on Cargo credits through a managed connection, so none needs
a key in `.env`. Prices change, so this file names no number. Read the live
per-record price with `cargo-ai connection integration get <slug>` before any
sync.

## Why this order

Sales Navigator, then AI Ark, then Apollo, then Exa. The unify tool recognises
a company the TAM already holds before it pays to enrich it, so the order
decides what you pay for: the largest source goes first, and every later one
mostly confirms companies already there, for free. The order also gives the
report its "added in this order" column.

## Sales Navigator

- **For:** LinkedIn's own taxonomy, which is what reps see. Every row carries
  the LinkedIn company id, the key the TAM is merged on, so it never pays to
  resolve one.
- **Against:** one search serves at most 1,000 accounts. A market bigger than
  that is split into several searches, each under the cap: run the
  `extract-sales-navigator-search` skill, which counts, splits, merges back to
  the fewest searches and re-counts, then paste its URLs into the model. Counts
  drift week to week, so re-count right before you sync. A count costs a fixed
  fee per search.
- **No seat:** leave `identityIds` off. Searches run on Cargo's side without a
  LinkedIn account.

## AI Ark

- **For:** `countCompanies` is free and takes the same filter groups,
  `lookalikeDomains` included, so the pool is sized before anything bills.
  `lookalikeDomains` (up to five customer domains) finds companies that look
  like your best customers, which a filter search ranks low or files elsewhere.
- **Against:** industries are enum members resolved through `listIndustries`,
  or they match nothing. A sync caps at 10,000 records.

## Apollo

- **For:** a different database searched with the same brief, which is what
  makes the Sales Navigator × Apollo overlap usable for the coverage estimate.
  Hiring filters (`q_organization_job_titles`, `organization_num_jobs_range`)
  and funding filters are there if your market is defined by them.
- **Against:** no industry taxonomy: industries are keyword tags, which over-
  and under-match. That is acceptable here because no source label is trusted:
  every company is classified from its own description. No free count, so
  size the pool with a small `limit` first.

## Exa

- **For:** it finds companies by what their website says, which is how it
  reaches the ones LinkedIn files under an industry nobody would filter on.
- **Against:** it has no extractor, so it runs from written queries, one row
  each in `tam_exa_queries`. It returns pages, reduced to a domain, so every
  new company pays a domain-to-LinkedIn resolution. Billed per returned result.
- **Queries that worked:** one per category and country, written the way a
  buyer would describe the company: "AI agent platform headquartered in
  France, 50 to 1,000 employees, selling to businesses".

## Other sources

| Source                     | When to add it                                       | How                                                                                                                         |
| -------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| FullEnrich                 | Free per record, so a scheduled refresh costs nothing | A fifth source model and play, the same shape as AI Ark's. Edit the connector list in `evals/contract.mjs` in the same change |
| A reference list (Crunchbase export, an old TAM, a CRM list built another way) | A better coverage estimate | The `reference-list` variation in SKILL.md                                                         |
