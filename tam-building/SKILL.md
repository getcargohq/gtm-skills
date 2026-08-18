---
name: tam-building
description: 'Stand up your account universe as a deployed pipeline: a Sales Navigator company search split past the 1,000 extraction cap, resolved to real domains, deduped into a shared accounts model. Triggers: "our TAM is a stale CSV", "build our account universe", "the search has more companies than it will export", "keep our market list current", "size our market then load it". Cargo CDK, salesNavigator, searchCompanyMetrics, fetchAccountSearch, accounts model. Skip when: you want the list once rather than a pipeline that keeps producing it, which is cargo-gtm''s build-tam recipe.'
version: "0.2.0"
compatibility: "Requires @cargo-ai/cli (npm) and a Cargo workspace. No LinkedIn seat, user, or cookie is needed: Sales Nav extraction in Cargo is cookieless."
homepage: https://github.com/getcargohq/cargo-cookbooks/tree/main/tam-building
outcome: "Your account universe built from a Sales Navigator company search, split past the 1,000 extraction cap and resolved to real domains"
chain: 2
state: to-be-approved
approval:
  demoWorkspace: null
  implementations: []
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

# Tam building

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this cookbook until the frontmatter says `approved`.

## The outcome

Your account universe, built from the Sales Navigator search that describes your whole market,
even when that search returns far more than the extractor will hand over. Counted before it is
extracted, split into sub-searches that each sit under the cap, resolved to real domains, and
merged into the shared `accounts` model deduped.

The count is a design-time CLI call, not a deployed resource:

```bash
cargo-ai orchestration action execute --wait-until-finished \
  --action '{"kind":"connector","integrationSlug":"salesNavigator","actionSlug":"searchCompanyMetrics","config":{}}' \
  --data '{"url":"<your Sales Navigator company-search URL>"}'
```

It returns `total_results` and costs a fraction of a credit. Splitting order that usually works:
industry first (descend the LinkedIn taxonomy only where a segment is still oversized), then
geography, then headcount band. Recount every sub-search; split any that is still over.

## The procedure lives in `deploy-cookbook`

Scaffold or add, adapt, plan, deploy, verify: the same for every cookbook, written once.

```bash
npx skills add getcargohq/cargo-cookbooks/deploy-cookbook   # if it is not already in this session
cargo-ai cdk init my-tam --from getcargohq/cargo-cookbooks/tam-building   # empty directory
cargo-ai manifest add tam-building --dir .                            # existing CDK project
```

Read `README.md` in this folder before answering anything below. It explains why the design is the
way it is, and that is what makes a good answer possible.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the ones marked
_asked_ genuinely live in the operator's head.

| Input                                                      | Kind   | How it is answered                                                                                                                                                                                                                                                                                                                                                     | Why it matters                                                                                                                                               |
| ---------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `marketSearch`                                             | manual | **checked, not written**: Paste the Sales Navigator company search that describes your whole market, however oversized it is                                                                                                                                                                                                                                           | This is the only input that cannot be derived: it encodes who you sell to. Everything else in this cookbook is arithmetic on top of it.                      |
| `searchUrls` (`tam-building/models/salesnav-companies.ts`) | value  | **derived**: cargo-ai orchestration action execute --action salesNavigator.searchCompanyMetrics --data '{"url":"<marketSearch>"}' returns total_results. Over the cap, split by facet (industry first, descending the LinkedIn taxonomy only where still oversized, then geography, then headcount band) and recount each sub-search until every one is under the cap. | A search holding 4,000 companies extracts 1,000 and tells you nothing about the missing 3,000. Splitting under the cap is the entire point of this cookbook. |
| `limit` (`tam-building/models/salesnav-companies.ts`)      | value  | defaults to `1000`; ask only to change it                                                                                                                                                                                                                                                                                                                              | This is the upstream cost control. Promotion is 1:1 with extraction, so what you extract is what you pay to enrich.                                          |

Checked before moving on, not after the deploy:

- `marketSearch`: the URL is a linkedin.com/sales/search/company URL
- `searchUrls`: every sub-search count is strictly below config.limit; a count equal to the cap means it is still truncated and must be split again
- `limit`: at or below 1000

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the default.

| Variation                | When it is right                                                                        | How                                                                                                                                                                                                                                                                                 | What it costs                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `non-linkedin-source`    | You do not want to source from LinkedIn at all, or Sales Nav does not cover your market | Swap the Sales Nav connector and landing model for the Ark enrichment API (https://ai-ark.com/platform/enrichment-api), keeping `promote-to-accounts` and the `accounts` contract unchanged (`tam-building/models/salesnav-companies.ts`, `base-gtm/connectors/sales-navigator.ts`) | You lose the Sales Nav facet taxonomy that makes the split tactic mechanical, and the splitting has to be redesigned around the new source's own limits |
| `land-without-promoting` | You want to see and filter the raw market before paying to enrich it                    | Deploy the landing model only and leave `promote-to-accounts` out until you have decided which rows are worth promoting (`tam-building/plays/promote-to-accounts.ts`)                                                                                                               | Nothing reaches `accounts`, so no downstream cookbook (scoring, contact sourcing, signals) has anything to work with until you promote                  |
| `sample-first`           | The market search is large and you want to see the cost curve before committing         | Set `config.limit` well below the cap and start with one sub-search URL, then widen once rows land correctly (`tam-building/models/salesnav-companies.ts`)                                                                                                                          | Your TAM is deliberately incomplete until you widen it, so do not score or report on coverage from a sample                                             |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **Every company is resolved to a real domain before it is promoted into `accounts`.** (`tam-building/plays/promote-to-accounts.ts`) The shared `accounts` model keys on `website`. A domainless account cannot be deduped, so it forks into duplicates the first time the same company appears in another list. This is why a row that cannot be resolved is dropped rather than written.
- **Every search is counted before it is extracted.** (`tam-building/models/salesnav-companies.ts`) Extracting blind is how you take a silently truncated list: the search holds 4,000 companies, the extractor takes 1,000, and nothing tells you the rest exist.
- **No sub-search sits at or above the extraction cap.** (`tam-building/models/salesnav-companies.ts`) A search returning exactly the cap is truncated. That is the failure this whole cookbook exists to prevent, and it is invisible unless you check the number.

## Done when

- the sub-search extractions sum to roughly the count of the original whole-market search
- no sub-search returned exactly the cap, which would mean it is still truncated
- promoted accounts appear in `accounts` with a website, deduped across overlapping sub-searches

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
