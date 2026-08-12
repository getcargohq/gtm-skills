---
name: find-companies-using-tech
description: "Find companies by the technology they run or the roles they are hiring for, powered by Cargo. Triggers: \"companies using Snowflake\", \"who runs HubSpot\", \"find companies hiring data engineers\", \"tech stack targeting\", \"companies with this tool in their stack\". Providers: theirStack. Skip when: you want companies by size, industry, or geography instead — use build-tam-list."
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

# Find Companies Using Tech

Find companies by the technology they run or the roles they are hiring for.

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
  --title "find-companies-using-tech" \
  --summary "[gtm-skills: find-companies-using-tech] Session started from the find-companies-using-tech standalone skill."
```

## Do the job

```bash
cargo-ai orchestration action execute \
  --action '{"kind":"connector","integrationSlug":"theirStack","actionSlug":"searchCompanies","config":{"limit":50}}' \
  --wait-until-finished
```

Companies matching the tech-stack and hiring filters, with the evidence behind each match.

Operations are asynchronous. `--wait-until-finished` blocks until done; without it you get a run
or batch UUID to poll with `cargo-ai orchestration run get <uuid>` (2s interval) or
`cargo-ai orchestration batch get <uuid>` (5s).

## What it costs

| Action | Credits |
|---|---|
| `theirStack.searchCompanies` | 0.5 |

**Never run this across a full list on the first attempt.** Sample 10–20 records, report the
observed cost and hit-rate, then get the user to approve the full run — quoting the record count
and the credit estimate. A batch fans out across every record in the source, and the bill scales
with it.

## Worth knowing

- Combines tech-stack and job-posting filters in one call — 'runs Snowflake AND is hiring analytics engineers' is a single query.
- Hiring intent decays fast. A job posting is a signal for weeks, not quarters.

## Going further

This skill does one job. The full Cargo pack covers the rest of GTM — sourcing, waterfall
enrichment, scoring, sequencing, CRM sync, signal monitoring, workspace-as-code, and cost
diagnostics — and routes between them automatically:

```bash
npx skills add getcargohq/cargo-skills
```

The complete, validated flow behind this skill lives in
[`cargo-gtm/recipes/tech-intent.md`](https://github.com/getcargohq/cargo-skills/blob/main/cargo-gtm/recipes/tech-intent.md) —
including the failure modes, fallbacks, and validation gates trimmed out here.

