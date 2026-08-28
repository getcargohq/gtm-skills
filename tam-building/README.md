# TAM building

Build your account universe from a Sales Navigator company search, even when the
natural search returns far more than the extraction cap.

## What it does

- Counts a search **before** extracting it, so you never take a silently
  truncated list.
- Splits an oversized search into sub-searches that each sit under the cap, and
  unions them into one table.
- Resolves each Sales Nav company to a real domain (Sales Nav does not give you
  one) and merges it into the shared `accounts` model, deduped.
- Costs nothing to try: Sales Nav extraction in Cargo is **cookieless**, so no
  LinkedIn seat, user, or cookie is needed. Only the search URL.

## How it works

1. **Write the giant search.** The one that describes your whole market, in the
   Sales Navigator UI. Copy its URL.
2. **Count it, do not extract it.** Counting is design-time work you do from your
   terminal, so it needs no deployed resource. Call the action directly:

   ```sh
   cargo-ai orchestration action execute --wait-until-finished \
     --action '{"kind":"connector","integrationSlug":"salesNavigator","actionSlug":"searchCompanyMetrics","config":{}}' \
     --data '{"url":"<your Sales Navigator company-search URL>"}'
   ```

   It returns `total_results` and costs a fraction of a credit. Extracting blind
   is how you end up with a silently truncated list: the search holds 4,000
   companies, the extractor takes 1,000, and nothing tells you the rest exist.

3. **Over 1,000? Split by facet.** Industry first: the LinkedIn industry taxonomy
   has three levels, so start at Level 1 and descend into Level 2 or 3 only for
   the segments that are still oversized. Then geography, then headcount band.
4. **Recurse.** Count each sub-search with the same command. Split any that is
   still over. Stop when every search is under the cap.
5. **Extract.** Put the final sub-search URLs in the `salesnav_companies` model.
   Rows from every URL land in that one table.
6. **Promote.** For each row, `promote-to-accounts` matches the company in
   Cargo's business database, pulls its website and firmographics, and upserts it
   into `accounts` keyed on `website`. Overlapping sub-searches (they will
   overlap: facets do) collapse to one account.

Adds 3 resources on top of the base. Counting is a CLI call, not a deployed
tool: you run it while designing the search, and a tool that only ever wraps one
connector action in a workflow is ceremony, not a resource.

| File                                  | Resource          | Role                                                     |
| ------------------------------------- | ----------------- | -------------------------------------------------------- |
| `infra/connectors/sales-navigator.ts` | `defineConnector` | Sales Navigator, adopted: no key, no seat, no cookie     |
| `infra/models/salesnav-companies.ts`  | `defineModel`     | the landing table: one row per extracted company         |
| `infra/plays/promote-to-accounts.ts`  | `definePlay`      | resolve a domain, then upsert into the shared `accounts` |

## Why the domain resolution is not optional

A Sales Nav company row carries a name and a LinkedIn company id, but **no
domain**. The shared `accounts` model keys on `website`. A row that cannot be
resolved to a website is therefore dropped rather than written, because a
domainless account cannot be deduped and will quietly fork into duplicates the
first time it appears in another list.

## Placeholders (edit before deploy)

1. **Sub-search URLs** in `infra/models/salesnav-companies.ts` `config.urls`: your
   real, counted, under-the-cap Sales Navigator company-search URLs.
2. **The cap** in the same file, `config.limit`: keep at or below 1,000. A search
   that returns exactly this number is truncated, which is the failure this
   skill exists to prevent.

The industry, geography, and headcount facets in a Sales Nav search are opaque
LinkedIn ids. Build the searches in the Sales Nav UI and copy the URLs; there is
no taxonomy lookup in the CDK.

## Done when

The sub-search extractions sum to roughly the count of the original giant search,
no sub-search sits exactly at the cap (which would mean it is truncated), and the
promoted accounts appear in `accounts` with a website, deduped across overlapping
sub-searches.

## Cost

Read this before pointing the skill at a market-sized search.

Counting is a fraction of a credit and is the cheapest insurance here. The
expensive step is promotion: **every promoted company costs two credited calls**
(`matchBusiness` + `enrichBusinessFirmographics`), and there is no cheaper path,
because Sales Nav returns no domain and both calls are needed to resolve one. A
5,000-company TAM is therefore around 10,000 enrichment calls. That is the price
of the outcome, not waste, but it is real money and you should decide to spend it
on purpose.

The promote play runs on `watch`, so it fires once per extracted row: promotion
is **1:1 with extraction**, and the number of accounts you pay to enrich equals
the number of rows your searches pull in. The cost control is therefore
**upstream**, where the rows are created: the extraction cap in
`infra/models/salesnav-companies.ts` (`config.limit`) and how many sub-search URLs you
add. To spend less, extract less. Start with one small sub-search, watch it land
correctly, then widen. There are no API keys to buy: everything is
credits-based.

## Alternatives

For a non-LinkedIn company source, the [Ark enrichment
API](https://ai-ark.com/platform/enrichment-api) covers the same ground.

## Composes into

`list-building` (the same split tactic for people), `contact-sourcing` (find the
buyers at every account you just built), `account-scoring`, and
`signal-based-tam` (watch the universe you just built for buying signals).
