# Win-loss review

Turn what the CRM says about won and lost deals into the knowledge layer every other agent reads.
The platform extracts the CRM into models, a Claude Code harness agent audits them with fixed SQL
once a month, and the result lands as one pull request and a five-line Slack digest.

## What it does

- **Extracts the CRM into models.** `crm_deals` (closed deals, the audit's properties, never an
  amount), `crm_accounts` and `crm_contacts`. Extraction bills no credits, and the last two are the
  same models crm-enrichment and crm-deduplication declare.
- **Audits with fixed SQL.** The prompt carries the queries: counts by pipeline, lost reasons,
  contacts on deals, won versus lost by industry, size and country, titles at won accounts, and the
  deals since the last run. The agent runs those and no other.
- **States the hygiene findings.** The lost-reason fill rate and the deal-to-contact rate open
  every pull request, with their denominators, and decide what can be written.
- **Writes, then appends.** The first pass verifies `icp/` (one dated section if it is seeded) and
  writes `insight/`, `objection/` and `client/`. Every month after adds files and edits none.
  Personas are never edited; changes are proposals in the pull request body.
- **Records the run.** `outputs/<date>-win-loss-review/README.md` holds each query's result, which
  every `[R: <query>]` tag points to.

## Resources

| File                                      | Resource                        | Role                                                               |
| ----------------------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `infra/agents/win-loss-analyst.ts`        | `defineAgent` (claudeCode)      | monthly cron, locked Slack channel, no env                         |
| `infra/agents/win-loss-analyst.prompt.ts` | (not a resource)                | the audit's SQL, the first pass, the monthly append, the digest    |
| `infra/models/crm-deals.ts`               | `defineModel` (`crm_deals`)     | closed deals, picked properties, no amount                         |
| `infra/models/crm-accounts.ts`            | `defineModel` (`crm_accounts`)  | the accounts behind the deals, shared with the other CRM cookbooks |
| `infra/models/crm-contacts.ts`            | `defineModel` (`crm_contacts`)  | the people at the accounts, shared with the other CRM cookbooks    |
| `infra/connectors/crm.ts`                 | `defineConnector` (`hubspot`)   | the CRM the models extract, bound                                  |
| `infra/connectors/anthropic.ts`           | `defineConnector` (`anthropic`) | the model the harness runs on, billed and metered                  |
| `infra/connectors/git.ts`                 | `defineConnector` (`github`)    | the clone, branch, push and PR path, resolved by binding           |
| `infra/connectors/slack.ts`               | `defineConnector` (`slack`)     | the digest, through a locked `postMessage`                         |
| `infra/folders/index.ts`                  | `defineFolder` ×2               | the agent and the models, filed under the cookbook                 |

## Why models, not a script

The audit is counts and joins, which is what SQL is for. A collector that pages through CRM search
results re-implements pagination, filters and aggregation per CRM, and every one of those is a place
to return part of the window as if it were all of it. Models leave extraction to the platform,
keep the raw deals in Cargo storage rather than in the repository, and are shared: a project that
already runs crm-enrichment or crm-deduplication extracts its accounts and contacts once.

## Why one source

A cookbook is a prebuilt approach an agent follows. Give it two kinds of evidence, a page and a
deal, and it has to hold two confidence levels in one run and the reader has to tell them apart
afterwards. So this cookbook holds one: the CRM. The website has `web-capture`, which seeds what
this one verifies; calls have `call-capture`.

## Placeholders (edit before deploy)

1. **`languageModel`** on the agent, and the Slack **`channelId`** on its `postMessage` use.
2. **The lost-reason property**, in `infra/models/crm-deals.ts` and as `LOST_REASON_COLUMN` in the
   prompt, when the portal records it on a custom property.

## What it does not do

It does not read a call, an inbox or a website; run SQL beyond its own queries; write to the CRM;
extract or write a deal amount; write the workspace context directly; edit a persona, or the ICP
after the first pass; or merge its own pull request.

## Verify

From this skill's folder:

```sh
node --import tsx evals/contract.mjs
```

From the project root:

```sh
npm run check && cargo-ai cdk plan
```
