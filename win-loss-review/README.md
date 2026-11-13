# Win-loss review: a scoring model from your best customers, and an ICP verified every month

To learn who you should sell to, read your own deals two ways. Once, a scoring pass defines Tier 1
from what customers did after signing (renewed, expanded, went live fast, stayed cheap to serve),
tests standard and custom attributes against Tier 2 across the enriched cohort, and writes
`context/icp/scoring.md`: a fit model with a weight, a reason and evidence for every attribute.
Every month, a Claude Code harness agent runs fixed SQL over the CRM extracted into Cargo models and
lands the ICP check, dated insights and objections in `context/` as one pull request, with a
five-line Slack digest.

```sh
cargo-ai project add cookbook/win-loss-review
```

## What it does

- **Builds the scoring model, once.** [`references/scoring-pass.md`](references/scoring-pass.md),
  run in the operator's session with three stops: audit and window, Tier 1 and four questions to
  the team, a priced 10-account enrichment test. Candidates come from the team's assumptions, the
  calls, and [`references/custom-attributes.md`](references/custom-attributes.md) run on your own
  domain. The model lands in the shape [`references/scoring-format.md`](references/scoring-format.md)
  fixes, with a block a script can compute.
- **Extracts the CRM into models, whole.** `crm_deals`, `crm_accounts` and `crm_contacts`: every
  record, every column, no filter in the config. Extraction bills no credits, and the last two are
  the same models crm-enrichment and crm-deduplication declare.
- **Audits with fixed SQL.** The prompt carries the queries: counts by pipeline, lost reasons,
  contacts on deals, won versus lost by industry, size and country, titles at won accounts, and the
  deals since the last run. The agent runs those and no other.
- **States the hygiene findings.** The lost-reason fill rate and the deal-to-contact rate open
  every pull request, with their denominators, and decide what can be written.
- **Writes, then appends.** The first pass verifies `icp/` (one dated section if it is seeded) and
  writes `insight/`, `objection/` and `client/`. Every month after adds files and edits none.
  Personas and `scoring.md` are never edited by the monthly agent; changes are proposals in the pull
  request body.
- **Records each run.** `outputs/<date>-win-loss-review/README.md` holds each monthly query's
  result, and `outputs/<date>-win-loss-scoring/` the scoring pass's evidence and scripts.

## Resources

| File                                      | Resource                        | Role                                                               |
| ----------------------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `infra/agents/win-loss-analyst.ts`        | `defineAgent` (claudeCode)      | monthly cron, locked Slack channel, no env                         |
| `infra/agents/win-loss-analyst.prompt.ts` | (not a resource)                | the audit's SQL, the first pass, the monthly append, the digest    |
| `infra/models/crm-deals.ts`               | `defineModel` (`crm_deals`)     | every deal, all columns; the queries narrow to closed              |
| `infra/models/crm-accounts.ts`            | `defineModel` (`crm_accounts`)  | the accounts behind the deals, shared with the other CRM cookbooks |
| `infra/models/crm-contacts.ts`            | `defineModel` (`crm_contacts`)  | the people at the accounts, shared with the other CRM cookbooks    |
| `infra/connectors/crm.ts`                 | `defineConnector` (`hubspot`)   | the CRM the models extract, bound                                  |
| `infra/connectors/anthropic.ts`           | `defineConnector` (`anthropic`) | the model the harness runs on, billed and metered                  |
| `infra/connectors/git.ts`                 | `defineConnector` (`github`)    | the clone, branch, push and PR path, resolved by binding           |
| `infra/connectors/slack.ts`               | `defineConnector` (`slack`)     | the digest, through a locked `postMessage`                         |
| `infra/folders/index.ts`                  | `defineFolder` ×2               | the agent and the models, filed under the cookbook                 |

## Why Tier 1 against Tier 2

A model trained on won against lost learns who buys, and the won side holds the churners and the
accounts that cost more to serve than they paid. A model trained on Tier 1 against Tier 2 learns who
succeeds, which is the difference between a Strong account and a Moderate one in the market. Lost
and churned deals still count: they say what Weak looks like. And only attributes a company shows
before it buys get a weight, because the model's job is to grade companies that have never been
customers.

## Why the scoring pass runs in a session

It asks the team four questions nobody else can answer (their best customers, the ones they should
never have signed, what they never target, what they already believe), and it spends credits on
enrichment. Both need a person, so it stops three times instead of running on a cron. The monthly
half needs no person, so it does not wait for one.

## Why models, not a script

The monthly audit is counts and joins, which is what SQL is for. A collector that pages through CRM
search results re-implements pagination, filters and aggregation per CRM, and every one of those is
a place to return part of the window as if it were all of it. Models leave extraction to the
platform, keep the raw deals in Cargo storage rather than in the repository, and are shared: a
project that already runs crm-enrichment or crm-deduplication extracts its accounts and contacts
once.

## Why the monthly agent reads one source

A monthly run that holds two kinds of evidence, a page and a deal, holds two confidence levels in
one run, and the reader has to tell them apart afterwards. So the monthly agent holds one: the CRM.
The website has `web-capture`, which seeds what this one verifies; calls have `call-capture`, whose
archive the scoring pass reads with a person reviewing it.

## Placeholders (edit before deploy)

1. **`languageModel`** on the agent, and the Slack **`channelId`** on its `postMessage` use.
2. **The lost-reason property**, as `LOST_REASON_COLUMN` in the prompt, when the portal records it on
   a custom property.

## What it does not do

The monthly agent does not read a call, an inbox or a website; run SQL beyond its own queries;
write to the CRM; select or write a deal amount; write the workspace context directly; edit a
persona, the ICP after the first pass, or `scoring.md`; or merge its own pull request. The scoring
pass does not weight an attribute a non-customer cannot show, write an amount or a person into the
repository, spend past the 10-account test without a yes, or score anything in the market: that is
`account-scoring`.

## Verify

From this skill's folder:

```sh
node --import tsx evals/contract.mjs
```

From the project root:

```sh
npm run check && cargo-ai project plan
```
