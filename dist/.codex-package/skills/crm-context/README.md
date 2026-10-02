# CRM context

Turn what the CRM knows about who buys and who does not into things a repository can hold: an
audit snapshot, an ICP verified against won versus lost, dated insights with denominators,
objections from recorded lost reasons, a client file per win. Audited by a committed script,
written by a Claude Code harness agent, delivered as one pull request a month and five lines in
Slack.

## What it does

- **Audits.** `scripts/collect/crm.ts` reads the last twelve months of closed deals, the accounts
  behind them and the contacts on the won ones, and writes one JSON under `cadence/log/raw/crm/`.
  Deterministic, no LLM, free. Its won count sets the mode: `verify` at twenty or more, else
  `hypothesis`.
- **States the hygiene.** Lost reason filled on n of N lost deals; contacts on n of N closed deals.
  Both open every pull request, and the first decides whether objections can come from the CRM.
- **Verifies, once.** The first pass appends a dated "Verified against the CRM" section to the
  seeded ICP (or writes the file), with a disqualifier from won versus lost.
- **Appends, monthly.** Dated `insight/` files in three buckets (who we talk to, where we win,
  where we lose), `objection/` from recurring lost reasons, `client/` per closed-won account.
  Nothing existing is edited; a change to `icp/` or `persona/` is a proposal in the pull request.
- **Stops.** One pull request, never merged, and one five-line digest through `slack.postMessage`
  to a locked channel. Nothing here reads calls, postings or the website: those are other
  cookbooks' evidence.

## How it works

1. **The cron fires** on the first of the month (the first pass is started by hand).
2. **The agent clones the repository** and runs the audit, which finds the CRM among the
   workspace's connections, walks the window, and diffs against the previous snapshot.
3. **It states the two hygiene findings and the mode**, then writes: the whole window on the first
   pass, only the new deals after.
4. **It opens one pull request** and posts the digest. A human merges; the next
   `cargo-ai cdk deploy` syncs `context/` into the workspace.

Adds 4 resources plus a script bundle.

| File                                      | Resource                        | Role                                                                                 |
| ----------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `infra/agents/win-loss-analyst.ts`        | `defineAgent` (claudeCode)      | monthly cron, locked Slack channel on `postMessage`, no env                          |
| `infra/agents/win-loss-analyst.prompt.ts` | (not a resource)                | its contract: the first pass, the monthly append, what is never edited               |
| `infra/connectors/anthropic.ts`           | `defineConnector` (`anthropic`) | the model the harness runs on, billed and metered                                    |
| `infra/connectors/git.ts`                 | `defineConnector` (`github`)    | the clone, branch, push and PR path, resolved by binding                             |
| `infra/connectors/slack.ts`               | `defineConnector` (`slack`)     | the digest's action, channel locked on the use                                       |
| `infra/folders/index.ts`                  | `defineFolder`                  | the workspace folder the agent is filed in                                           |
| `scripts/collect/crm.ts`                  | (not a resource)                | the audit entrypoint                                                                 |
| `scripts/collect/audit.ts`                | (not a resource)                | the `Crm` contract and the CRM-agnostic aggregation and file layout                  |
| `scripts/collect/crms/`                   | (not a resource)                | the HubSpot adapter and the registry                                                 |
| `scripts/collect/config.ts`               | (not a resource)                | the CRM choice, the pipelines, the window, the lost-reason property, the verify line |
| `scripts/collect/cli.ts`                  | (not a resource)                | the one way the script reaches Cargo: its CLI, signed in                             |

## The two halves, and where they land

```
crm-context/infra/     ->  infra/crm-context/      what is declared and deployed
crm-context/scripts/   ->  scripts/crm-context/    what the agent runs
```

Those are the layers `cargo-ai cdk init` already scaffolds, and `scripts/package.json` is what
stops the CDK loader importing the audit and running it against the live CRM on every plan.

## Why one source

A cookbook is a prebuilt approach an agent follows. Give it two kinds of evidence, a deal and a
page, and it has to hold two confidence levels in one run and the reader has to tell them apart
afterwards. So this cookbook holds one: what the CRM records, with denominators. The public
surface has its own cookbook that seeds the layer; calls have theirs. Isolated, each runs on its
own, and this one runs on a cron with nobody in the loop.

## Why no CRM connector resource

A bound connector declares no `config` to typecheck and fails at deploy when the workspace holds
no such connection. The audit resolves the CRM at run time from `cargo-ai connection connector
list` instead: a project whose other cookbooks already bind one needs nothing rewired, and a
workspace without one gets a snapshot that says so rather than a failed deploy.

## Why the context is not in this folder

`defineContext` is a per-workspace singleton, and the knowledge layer belongs at the repository root
where humans edit it, which is exactly where `cargo-ai cdk init` already declares it. So this
folder ships none.

## Placeholders (edit before deploy)

1. **`channelId`** on the agent's `postMessage` use. An id, not a name; never a customer shared
   channel.
2. **`languageModel`** on the agent.
3. **`LOST_REASON_PROPERTY`** in `scripts/collect/config.ts`, when the audit's fill rate reads 0
   of N with lost deals in the window.
4. **`PIPELINES`** in the same file, when the snapshot lists more than one.

## What it does not do

It does not read calls, postings, the website or an inbox; write the workspace context directly;
write to the CRM; write a deal amount into `context/`; edit a persona; edit the ICP after the first
pass; contact anyone; post anywhere but the locked channel; or merge its own pull request.
