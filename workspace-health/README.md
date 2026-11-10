# Workspace health: know the morning something breaks

Every morning a Claude Code harness agent reads the last 24 hours of the workspace against the week
before and posts to Slack only when something is wrong and new: failing runs grouped by cause, a
lost connector, a play that stopped, runs that succeed and write nothing, a credit spike, a stuck
batch. Mondays it posts the week.

```sh
cargo-ai project add cookbook/workspace-health
```

## Why it is built this way

- **A harness agent, for the CLI.** The orchestration SQL surface (`cargo-ai orchestration query
  execute`) groups a day of failures by workflow and node in one query, and the harness is what puts
  that CLI in reach. It clones the project for the toolchain and never pushes.
- **Slack read-back is the memory.** The agent reads its own earlier posts with
  `getConversationHistory`, locked to the channel it posts in, so a finding is said once and then
  rolls into Monday. No state file, no pull request a day.
- **Silence means healthy because Monday always posts.** Without the weekly line a dead watcher and
  a clean workspace look the same.
- **Thresholds, not every error.** Enrichment that finds no email for some records is provider
  coverage. A finding is a rate above `HEALTH_ERROR_RATE` or a spend above
  `HEALTH_SPEND_MULTIPLE`, both set on the agent so the prompt never invents them.
- **It reports and never fixes.** Reruns bill, and a disabled play may be disabled on purpose.
- **The deep dive belongs to `cargo-diagnostics`.** This agent traces at most two runs per failing
  workflow, enough to name the cause, and hands you the run to open.

## Files

| File | What it is |
| --- | --- |
| `infra/agents/workspace-health.ts` | the agent: daily cron, harness, post and history read locked to one channel, thresholds |
| `infra/agents/workspace-health.prompt.ts` | the contract: the five checks, dedup, the Monday line |
| `infra/connectors/` | Anthropic, GitHub and Slack, all bound with `default: true` |
| `infra/folders/index.ts` | the agent folder, named after the cookbook |
| `evals/contract.mjs` | the boundaries schema validation cannot express |
| `evals/acceptance.md` | the walk-through after the first run |
