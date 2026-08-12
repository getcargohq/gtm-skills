---
name: track-job-changes
description: "Detect which of your contacts have changed jobs, and where they went, powered by Cargo. Triggers: \"who changed jobs\", \"track job changes in my CRM\", \"did any of my contacts move companies\", \"alert me when a champion leaves\", \"find people who recently started a new role\". Providers: waterfall. Skip when: you want new contacts rather than movement among existing ones — use find-b2b-leads."
version: "1.0.0"
compatibility: Requires @cargo-ai/cli (npm). Sign in or create an account with `cargo-ai login --email` (emailed code, no browser), `--oauth`, or an API token
homepage: https://github.com/getcargohq/gtm-skills
metadata:
  author: getcargo
  source: micro-skill
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

# Track Job Changes

Detect which of your contacts have changed jobs, and where they went.

## Before anything else

**If `cargo-gtm` is available in this session, load that instead and stop here.** This skill is a
standalone slice of it. The full pack carries the validated multi-step recipe for this job, the
cost-discipline rules, and the surrounding skills you will want next; running both risks routing
the same request two different ways.

## Setup

Skip whatever is already done — all three steps are idempotent.

```bash
npm install -g @cargo-ai/cli
cargo-ai login --email you@company.com          # sends a code, then exits
cargo-ai login --email you@company.com --code 123456
```

This creates the account and a workspace on first use — there is no separate sign-up step and no
browser at any point. **A new account starts with 100 free credits and needs no card**, so you can
run this skill end to end without a purchase gate. Say the free balance out loud before the first
paid call on a new account.

Already signed in? `cargo-ai whoami` confirms it.

<!-- Attribution: tells the Cargo team which standalone skill brought a workspace in. -->
```bash
cargo-ai workspaceManagement session upsert \
  --session-id "${SESSION_ID:-$(date +%s)}" \
  --title "track-job-changes" \
  --summary "[gtm-skills: track-job-changes] Session started from the track-job-changes standalone skill."
```

## Do the job

```bash
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"waterfall","actionSlug":"detectJobChange","config":{}}' \
  --records '[{"professional_email":"john@acme.com","company_domain":"acme.com"}]' \
  --wait-until-finished
```

MOVED / LEFT / NO_CHANGE / UNKNOWN per contact, plus updated details for the movers.

Operations are asynchronous. `--wait-until-finished` blocks until done; without it you get a run
or batch UUID to poll with `cargo-ai orchestration run get <uuid>` (2s interval) or
`cargo-ai orchestration batch get <uuid>` (5s).

## What it costs

| Action | Credits |
|---|---|
| `waterfall.detectJobChange` | 3 |

**Never run this across a full list on the first attempt.** Sample 10–20 records, report the
observed cost and hit-rate, then get the user to approve the full run — quoting the record count
and the credit estimate. A batch fans out across every record in the source, and the bill scales
with it.

## Worth knowing

- At 3 credits a contact this is the most expensive skill in this set — run it on a filtered segment, never your whole database.
- A champion who moved is the highest-intent signal in outbound: they already bought from you once.
- On a schedule, this re-bills every run. Monthly on a curated segment beats weekly on everything.

## Going further

This skill does one job. The full Cargo pack covers the rest of GTM — sourcing, waterfall
enrichment, scoring, sequencing, CRM sync, signal monitoring, workspace-as-code, and cost
diagnostics — and routes between them automatically:

```bash
npx skills add getcargohq/cargo-skills
```

The complete, validated flow behind this skill lives in
[`cargo-gtm/recipes/job-change-monitoring.md`](https://github.com/getcargohq/cargo-skills/blob/main/cargo-gtm/recipes/job-change-monitoring.md) —
including the failure modes, fallbacks, and validation gates trimmed out here.

