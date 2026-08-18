# List building

Build contact lists from Sales Navigator people searches, using the same
recursive split as TAM building, with a higher ceiling.

## What it does

- Counts a people search before extracting it, so no list is silently truncated.
- Splits an oversized search into sub-searches that each sit under the 2,500 cap.
- Resolves each person to a verified email (Sales Nav does not give you one) and
  merges them into the shared `contacts` model, deduped.

## How it works

1. **Write the people search** in Sales Navigator. Copy its URL.
2. **Count it** from your terminal, before extracting anything:

   ```sh
   cargo-ai orchestration action execute --wait-until-finished \
     --action '{"kind":"connector","integrationSlug":"salesNavigator","actionSlug":"searchPersonMetrics","config":{}}' \
     --data '{"url":"<your Sales Navigator people-search URL>"}'
   ```

   It returns `total_leads` plus a useful breakdown: who posted recently, who
   changed jobs, who viewed your profile. Read that breakdown, because it often
   tells you which slice is worth extracting first.

3. **Over 2,500? Split by facet.** Geography, then function, then seniority, then
   industry.
4. **Recurse** until every sub-search is under the cap.
5. **Extract** the final URLs into the `salesnav_leads` model.
6. **Promote.** For each row, `promote-to-contacts` enriches by LinkedIn profile
   URL through the waterfall, and upserts into `contacts` keyed on email.

Adds 2 resources on top of the base, and uses the shared Sales Navigator
connector in `connectors/`. Counting is a CLI call, not a deployed tool: it is
design-time work, and wrapping a single connector action in a workflow would be
ceremony.

| File                           | Resource      | Role                                                     |
| ------------------------------ | ------------- | -------------------------------------------------------- |
| `models/salesnav-leads.ts`     | `defineModel` | the landing table: one row per extracted person          |
| `plays/promote-to-contacts.ts` | `definePlay`  | resolve an email, then upsert into the shared `contacts` |

## Why the email resolution is not optional

A Sales Nav lead row has a name, a title, and a LinkedIn profile URL, but **no
email**. `contacts` keys on email. Rows are enriched by LinkedIn URL (the
highest-confidence key available, much better than guessing from name plus
company). A person we cannot resolve stays in the landing table rather than being
promoted: they are still a real person, and a later waterfall pass may find them.

## Placeholders (edit before deploy)

1. **Sub-search URLs** in `models/salesnav-leads.ts` `config.urls`: your real,
   counted, under-the-cap people-search URLs.
2. **The cap** in the same file, `config.limit`: keep at or below 2,500.

## Cost

Promotion costs **one credited `enrichContact` call per person**, and the cap is
2,500 per search, so a few sub-searches is thousands of calls. The play runs on
`watch`, so promotion is 1:1 with extraction: you control cost upstream, on the
extraction cap in `models/salesnav-leads.ts` and how many sub-searches you add.
Extract less to spend less. Counting is a fraction of a credit; everything is
credits-based, no API keys.

## Done when

The extracted contacts match the original count within tolerance, no sub-search
sits exactly at the cap, no duplicate LinkedIn profile survives the merge, and
promoted contacts appear in `contacts` with a verified email.

## Alternatives

When Sales Nav filters cannot express the persona, Apollo people search covers
the same job (`apolloio.searchPeople`).

## Composes into

`contact-sourcing` (per-account sourcing rather than per-search), `ai-sdr`, and
any outreach motion.
