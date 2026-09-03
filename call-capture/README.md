# Call capture

Turn the calls your team already records into things a repository can hold: a raw archive, an entry
per call, and — once a claim has been heard twice — an update to the knowledge layer every other
agent reads. Collected by a committed script, scribed by a Claude Code harness agent, delivered as
one pull request.

## What it does

- **Collects.** `scripts/collect/calls.ts` pulls every call in a three-day rolling window whose
  transcript the recorder has finished processing, and writes one raw file per call into
  `cadence/log/raw/calls/`. Deterministic, idempotent, no LLM anywhere near it.
- **Scribes.** The agent reads each pending raw capture and writes
  `cadence/log/calls/<date>-<account>.md`: what was said, the GTM intel under fixed headings, the
  actions as checkboxes. Capped at 12 per run, fresh-first then oldest-backfill.
- **Promotes.** A claim reaches `context/` — the knowledge layer at the repository root — only on
  its **second independent occurrence**, citing both calls.
- **Stops.** One pull request, never merged. The agent has repository write access and no other
  write path: no email, no CRM, no merge.

## How it works

1. **The cron trigger fires** at 07:00 UTC, after the recorder has finished processing yesterday.
2. **The agent clones the repository** — the project's own, resolved from the checkout's git origin
   at deploy rather than written down. The harness's working tree is the GTM repo itself, which is
   what lets its output be a diff rather than a column value.
3. **It runs the collector** — `npx tsx scripts/call-capture/collect/calls.ts` — which reads
   `CALL_RECORDER_API_KEY` from the harness environment, injected by the agent's `repository.env`. The agent
   is told not to fetch calls itself and not to edit the script's collection rules.
4. **It scribes** the pending captures, then promotes what repeats.
5. **It opens one pull request** whose body reports four numbers: captured, scribed fresh, scribed
   from backfill, pending remaining. The remainder is the drain gauge; a number that never falls
   means the cap is too low or a class of call is failing to parse.
6. **A human merges**, and the next `cargo-ai cdk deploy` syncs `context/` into the workspace
   context repository, where the scorer, the researcher and every other agent read it.

Adds 3 resources plus a script bundle.

| File                            | Resource                     | Role                                                       |
| ------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| `infra/agents/call-scribe.ts`   | `defineAgent` (claudeCode)   | schedule, repository binding, env, and the wiring          |
| `infra/agents/call-scribe.prompt.ts` | (not a resource)        | the scribe's contract: window, cap, repetition bar, limits |
| `infra/connectors/git.ts`       | `defineConnector` (`github`) | the clone, branch, push and PR path, resolved by binding   |
| `infra/folders/index.ts`  | `defineFolder`               | the workspace folder this cookbook's resources are filed in |
| `scripts/collect/recorder.ts`   | (not a resource)             | the `Recorder` contract and the provider-agnostic pipeline |
| `scripts/collect/avoma.ts`      | (not a resource)             | the one worked recorder implementation                     |
| `scripts/collect/calls.ts`      | (not a resource)             | the entrypoint: `await capture(avoma)`                     |

## The two halves, and where they land

This cookbook has one directory per layer it touches, and the install mirrors each into its namesake
in the project:

```
call-capture/infra/     ->  infra/call-capture/      what is declared and deployed
call-capture/scripts/   ->  scripts/call-capture/    what the agent runs
```

Those are the layers `cargo-ai cdk init` already scaffolds — `infra/` is the CDK project, `scripts/`
is "imperative glue for runtime surfaces the CDK cannot declare yet" — so a cookbook that needs both
contributes to both under its own name rather than inventing a third place.

The `collect/` subdirectory is a namespace, not decoration: call recordings are the first sensor,
and the next one (Slack threads, reply metadata, product usage) lands beside it as its own
entrypoint rather than growing this one. The agent's step 1 names the collectors it runs, so adding
a sensor is a new file plus a line in the system prompt.

`scripts/package.json` is belt and braces. In a Manifest repo the CDK project root is `infra/`, so
nothing under `scripts/` is ever imported as a resource. In a project whose CDK root is the repo
root, the loader imports every `.ts` it finds **except** directories carrying a `package.json` —
without that file, `cargo-ai cdk plan` would import the collector and run it against the live API on
every plan.

## Why the split

The collection and the judgement are different jobs, and the failure modes for mixing them are not
symmetric.

A fetch loop an agent re-derives every morning is a fetch loop that silently changes shape: a window
that drifts, a filter that quietly widens, a field read differently on a day the model was less
careful. Nothing downstream can tell, because the archive is what everything downstream is diffed
against. So the fetch is a committed script and the agent is told not to improvise it.

The scribing is the opposite. It is judgement — what was actually agreed, whether this is the same
objection as last week, whether a vendor call is being misread as pipeline — and it produces a diff
across a dozen markdown files. That is what `harnessSlug: "claudeCode"` buys: a working tree, the
git history to read before writing, and a pull request. The LLM `connector` and `languageModel`
fields are unused and omitted, because the harness brings its own model.

## Supporting a different recorder

The collector is a contract and one implementation, not a fork point.
`recorder.ts` defines `Recorder` — a `provider` slug and three methods (`listReady`, `transcript`,
`notes`) — and holds everything that is true whoever records your calls: deduplication, account
slugging, the internal-domain filter, file layout, the rolling window, `--dry-run`. `avoma.ts` is
the one implementation. `calls.ts` is three lines of wiring.

A different recorder is a new file beside `avoma.ts` and a one-line import swap. The compiler is
what keeps that honest: a half-written adapter does not typecheck, and the error names the field
that is missing. Auth deliberately stays in the adapter — Bearer, Basic and a signed GraphQL POST
are three different things — while the 429 backoff is shared through `fetchJson(url, init)`, which
takes the whole request.

There is no `providers/` directory holding all three behind a switch. Shipping implementations Cargo
does not run means shipping code that rots, and "supported" starts implying "tested" when it means
"written once from documentation".

## Why the context is not in this folder

`defineContext` is a per-workspace singleton, and the knowledge layer belongs at the repository root
where humans edit it — which is exactly where `cargo-ai cdk init` already declares it. So this folder
ships none.

## Placeholders (edit before deploy)

1. **`CALL_CAPTURE_INTERNAL_DOMAIN`** — `infra/agents/call-scribe.ts`: your own email domain, or
   every internal standup is captured as a customer call.
2. **`CALL_RECORDER_API_KEY`** — exported before deploy, never committed.
3. **The recorder** — `scripts/collect/avoma.ts` is the shipped adapter. A different recorder
   is one new file satisfying `Recorder` plus a one-line import swap in `calls.ts`;
   `references/providers.md` carries Gong and Fireflies against the same contract.

## What it does not do

It does not contact anyone, write to a CRM, merge its own pull request, edit or delete a raw capture
or an existing log entry, or touch `plan/` and `infra/`. It reports what the field said; it does not
change the strategy or the deployed engine.
