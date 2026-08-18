---
name: tam-building
description: 'Stand up your account universe as a deployed pipeline: a Sales Navigator company search split past the 1,000 extraction cap, resolved to real domains, deduped into a shared accounts model. Triggers: "our TAM is a stale CSV", "build our account universe", "the search has more companies than it will export", "keep our market list current", "size our market then load it". Cargo CDK, salesNavigator, searchCompanyMetrics, fetchAccountSearch, accounts model. Skip when: you want the list once rather than a pipeline that keeps producing it, which is cargo-gtm''s build-tam recipe.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli (npm) and a Cargo workspace. No LinkedIn seat, user, or cookie is needed: Sales Nav extraction in Cargo is cookieless."
homepage: https://github.com/getcargohq/cargo-cookbooks/tree/main/tam-building
metadata:
  author: getcargo
  openclaw:
    requires:
      bins:
        - cargo-ai
    install:
      - kind: node
        package: "@cargo-ai/cli@latest"
        bins:
          - cargo-ai
    homepage: https://github.com/getcargohq/cargo-cookbooks
---

# TAM building

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this cookbook until `cookbook.json` says `approved`.

## The outcome

Your account universe, built from the Sales Navigator search that describes your whole market,
even when that search returns far more than the extractor will hand over. Counted before it is
extracted, split into sub-searches that each sit under the cap, resolved to real domains, and
merged into the shared `accounts` model deduped.

## The procedure lives in `deploy-cookbook`

Scaffold, fit, deploy, verify: all four steps are the same for every cookbook and are written once.

```bash
npx skills add getcargohq/cargo-cookbooks/deploy-cookbook   # if it is not already in this session
cargo-ai cdk init my-tam --from getcargohq/cargo-cookbooks/tam-building
```

Read `README.md` in this folder before answering the questions below. It explains why the split and
the domain resolution are not optional, and that is what makes a good answer possible.

## What you will be asked

Three inputs, in `cookbook.json`. Only the first is a real question.

| Input          | Derived, or asked                                                                                        | Why it matters                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `marketSearch` | **asked**                                                                                                | The one thing that cannot be looked up: it encodes who you sell to.                            |
| `searchUrls`   | **derived** by counting the market search and splitting by facet until every sub-search is under the cap | A search holding 4,000 companies extracts 1,000 and tells you nothing about the missing 3,000. |
| `limit`        | defaulted to 1,000                                                                                       | The upstream cost control. Promotion is 1:1 with extraction.                                   |

The count is a design-time CLI call, not a deployed resource:

```bash
cargo-ai orchestration action execute --wait-until-finished \
  --action '{"kind":"connector","integrationSlug":"salesNavigator","actionSlug":"searchCompanyMetrics","config":{}}' \
  --data '{"url":"<your Sales Navigator company-search URL>"}'
```

It returns `total_results` and costs a fraction of a credit. Splitting order that usually works:
industry first (descend the LinkedIn taxonomy only where a segment is still oversized), then
geography, then headcount band. Recount every sub-search; split any that is still over.

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers
them rather than waiting to be asked:

| Variation                | When it is right                                                                        | What it costs                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `non-linkedin-source`    | You do not want to source from LinkedIn at all, or Sales Nav does not cover your market | You lose the Sales Nav facet taxonomy that makes the split tactic mechanical, and the splitting has to be redesigned around the new source's own limits |
| `land-without-promoting` | You want to see and filter the raw market before paying to enrich it                    | Nothing reaches `accounts`, so no downstream cookbook (scoring, contact sourcing, signals) has anything to work with until you promote                  |
| `sample-first`           | The market search is large and you want to see the cost curve before committing         | Your TAM is deliberately incomplete until you widen it, so do not score or report on coverage from a sample                                             |

## What should not change

- **Every company is resolved to a real domain before it is promoted into `accounts`.** The shared `accounts` model keys on `website`. A domainless account cannot be deduped, so it forks into duplicates the first time the same company appears in another list. This is why a row that cannot be resolved is dropped rather than written.
- **Every search is counted before it is extracted.** Extracting blind is how you take a silently truncated list: the search holds 4,000 companies, the extractor takes 1,000, and nothing tells you the rest exist.
- **No sub-search sits at or above the extraction cap.** A search returning exactly the cap is truncated. That is the failure this whole cookbook exists to prevent, and it is invisible unless you check the number.

Ask for one of these anyway and the agent will tell you what breaks, then do it
if you still want it, and record why in `cookbook.json` `decisions`.

## Done when

- The sub-search extractions sum to roughly the count of the original whole-market search.
- No sub-search returned exactly the cap. That number means it is still truncated.
- Promoted accounts appear in `accounts` with a website, deduped across overlapping sub-searches
  (they will overlap: facets do).

## What it costs

Counting is a fraction of a credit and is the cheapest insurance here. **Promotion is the
expensive step:** every promoted company costs two credited calls (`matchBusiness` +
`enrichBusinessFirmographics`), because Sales Nav returns no domain and both are needed to resolve
one. A 5,000-company TAM is roughly 10,000 enrichment calls. That is the price of the outcome, not
waste, but it is real money and it should be spent on purpose.

The control is upstream, where the rows are created: `config.limit` and how many sub-search URLs
you add. **To spend less, extract less.** Start with one small sub-search, watch it land correctly,
then widen.

## Composes into

`list-building` (the same split tactic for people), `contact-sourcing` (the buyers at every account
you just built), `account-scoring`, `signal-based-tam` (watch the universe you just built).
