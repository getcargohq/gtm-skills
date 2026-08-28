---
name: tam-building
description: 'Stand up your account universe as a deployed pipeline: a Sales Navigator company search split past the 1,000 extraction cap, resolved to real domains, deduped into a shared accounts model. Triggers: "our TAM is a stale CSV", "build our account universe", "the search has more companies than it will export", "keep our market list current", "size our market then load it". Cargo CDK, salesNavigator, searchCompanyMetrics, fetchAccountSearch, accounts model. Skip when: you want the list once rather than a pipeline that keeps producing it, which is cargo-gtm''s build-tam recipe.'
version: "0.2.0"
compatibility: "Requires @cargo-ai/cli (npm) and a Cargo workspace. No LinkedIn seat, user, or cookie is needed: Sales Nav extraction in Cargo is cookieless."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/tam-building
metadata:
  author: getcargo
  source: cookbook
  openclaw:
    requires:
      bins:
        - cargo-ai
    install:
      - kind: node
        package: "@cargo-ai/cli@latest"
        bins:
          - cargo-ai
    homepage: https://github.com/getcargohq/gtm-skills
---

# Tam building

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

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

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job
is to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not,
this is enough.

1. **Look first.** `grep -l '@cargo-ai/cdk' package.json` says whether a CDK project already
   lives here; `ls */models/*.ts */connectors/*.ts` says what it already declares. If there is no
   project: `cargo-ai cdk init <dir> --template blank && cd <dir> && npm install`. That is the
   whole shell; this folder never ships one.
2. **Copy this folder in as a sibling of what is there**, then reconcile: for every model or
   connector this example carries that the project already has (an accounts model keyed on
   website, a HubSpot connector, an OpenAI connector), rewire the imports to the existing one and
   drop the copy. Two resources with one slug is a collision at deploy. Append this folder's
   `.env` needs to the project's `.env.example`; never overwrite it.
3. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted (nobody asks for a variant they do not know exists); _What you will be asked_
   is the floor, and you derive before you ask. If you are asking more than about four questions
   you have skipped lookups. Record what you changed and why under a `## Decisions` section in
   your copy of this file.
4. **Plan, then stop.** `npm run check && cargo-ai cdk plan` (`check` validates the resource tree
   offline; the blank template ships it). Show the diff. Deploy only on an explicit yes:
   `cargo-ai cdk deploy`. Never `cdk init --force` into a non-empty directory.
5. **Verify.** Walk _Done when_ line by line and report each with evidence. Deployed cleanly and
   produced nothing is the normal failure.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the ones marked
_asked_ genuinely live in the operator's head.

| Input                                               | Kind   | How it is answered                                                                                                                                                                                                                                                                                                                                                     | Why it matters                                                                                                                                            |
| --------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketSearch`                                      | manual | **checked, not written**: Paste the Sales Navigator company search that describes your whole market, however oversized it is                                                                                                                                                                                                                                           | This is the only input that cannot be derived: it encodes who you sell to. Everything else in this skill is arithmetic on top of it.                      |
| `searchUrls` (`infra/models/salesnav-companies.ts`) | value  | **derived**: cargo-ai orchestration action execute --action salesNavigator.searchCompanyMetrics --data '{"url":"<marketSearch>"}' returns total_results. Over the cap, split by facet (industry first, descending the LinkedIn taxonomy only where still oversized, then geography, then headcount band) and recount each sub-search until every one is under the cap. | A search holding 4,000 companies extracts 1,000 and tells you nothing about the missing 3,000. Splitting under the cap is the entire point of this skill. |
| `limit` (`infra/models/salesnav-companies.ts`)      | value  | defaults to `1000`; ask only to change it                                                                                                                                                                                                                                                                                                                              | This is the upstream cost control. Promotion is 1:1 with extraction, so what you extract is what you pay to enrich.                                       |

Checked before moving on, not after the deploy:

- `marketSearch`: the URL is a linkedin.com/sales/search/company URL
- `searchUrls`: every sub-search count is strictly below config.limit; a count equal to the cap means it is still truncated and must be split again
- `limit`: at or below 1000

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the default.

| Variation                | When it is right                                                                        | How                                                                                                                                                                                                                                                                       | What it costs                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `non-linkedin-source`    | You do not want to source from LinkedIn at all, or Sales Nav does not cover your market | Swap the Sales Nav connector and landing model for the Ark enrichment API (https://ai-ark.com/platform/enrichment-api), keeping `promote-to-accounts` and the `accounts` contract unchanged (`infra/models/salesnav-companies.ts`, `infra/connectors/sales-navigator.ts`) | You lose the Sales Nav facet taxonomy that makes the split tactic mechanical, and the splitting has to be redesigned around the new source's own limits |
| `land-without-promoting` | You want to see and filter the raw market before paying to enrich it                    | Deploy the landing model only and leave `promote-to-accounts` out until you have decided which rows are worth promoting (`infra/plays/promote-to-accounts.ts`)                                                                                                            | Nothing reaches `accounts`, so no downstream skill (scoring, contact sourcing, signals) has anything to work with until you promote                     |
| `sample-first`           | The market search is large and you want to see the cost curve before committing         | Set `config.limit` well below the cap and start with one sub-search URL, then widen once rows land correctly (`infra/models/salesnav-companies.ts`)                                                                                                                       | Your TAM is deliberately incomplete until you widen it, so do not score or report on coverage from a sample                                             |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **Every company is resolved to a real domain before it is promoted into `accounts`.** (`infra/plays/promote-to-accounts.ts`) The shared `accounts` model keys on `website`. A domainless account cannot be deduped, so it forks into duplicates the first time the same company appears in another list. This is why a row that cannot be resolved is dropped rather than written.
- **Every search is counted before it is extracted.** (`infra/models/salesnav-companies.ts`) Extracting blind is how you take a silently truncated list: the search holds 4,000 companies, the extractor takes 1,000, and nothing tells you the rest exist.
- **No sub-search sits at or above the extraction cap.** (`infra/models/salesnav-companies.ts`) A search returning exactly the cap is truncated. That is the failure this whole skill exists to prevent, and it is invisible unless you check the number.

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
