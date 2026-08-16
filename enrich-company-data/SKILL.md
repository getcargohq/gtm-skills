---
name: enrich-company-data
description: "Enrich a list of companies with firmographics — industry, size, geography, founding year, and headquarters, powered by Cargo. Triggers: \"enrich these companies\", \"add company size and industry to my list\", \"get firmographics for these domains\", \"fill in company data\", \"company enrichment\", \"enrich companies\", \"what sector is this business in\", \"how big is this organisation\". Providers: cargo. Skip when: you want funding history — use track-funding-rounds; or tech stack — use find-companies-using-tech."
version: "1.1.0"
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

# Enrich Company Data

Enrich a list of companies with firmographics — industry, size, geography, founding year, and headquarters.

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

<!-- Attribution: tells the Cargo team which standalone skill brought a workspace in.
     Skipped when the Cargo GTM plugin is installed: its session hooks stamp the same
     marker onto the real session row, and two rows for one session would double-count
     this skill in that query. -->
```bash
grep -q '"cargo@gtm"' ~/.claude/plugins/installed_plugins.json 2>/dev/null ||
  cargo-ai workspaceManagement session upsert \
    --session-id "${SESSION_ID:-$(date +%s)}" \
    --title "enrich-company-data" \
    --summary "[gtm-skills: enrich-company-data] Session started from the enrich-company-data standalone skill."
```

## Do the job

```bash
# 1. Resolve each company to a cargo business_id
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"cargo","actionSlug":"matchBusiness","config":{}}' \
  --records '[{"name":"Acme","domain":"acme.com"}]' \
  --wait-until-finished > matched.json

# 2. Enrich the matched ids
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"cargo","actionSlug":"enrichBusinessFirmographics","config":{}}' \
  --records "$(jq -c '[.results[] | {business_id}]' matched.json)" \
  --wait-until-finished
```

Industry, headcount, geography, founded year, and headquarters per company.

Operations are asynchronous. `--wait-until-finished` blocks until done; without it you get a run
or batch UUID to poll with `cargo-ai orchestration run get <uuid>` (2s interval) or
`cargo-ai orchestration batch get <uuid>` (5s).

## What it costs

| Action | Credits |
|---|---|
| `cargo.matchBusiness` | 0.5 |
| `cargo.enrichBusinessFirmographics` | 0.5 |

**Never run this across a full list on the first attempt.** Sample 10–20 records, report the
observed cost and hit-rate, then get the user to approve the full run — quoting the record count
and the credit estimate. A batch fans out across every record in the source, and the bill scales
with it.

## Worth knowing

- `matchBusiness` must run first — every other cargo business enrichment keys off the `business_id` it returns.

## Going further

This skill does one job. The full Cargo pack covers the rest of GTM — sourcing, waterfall
enrichment, scoring, sequencing, CRM sync, signal monitoring, workspace-as-code, and cost
diagnostics — and routes between them automatically:

```bash
npx skills add getcargohq/cargo-skills
```

The complete, validated flow behind this skill lives in
[`cargo-gtm/recipes/build-tam.md`](https://github.com/getcargohq/cargo-skills/blob/main/cargo-gtm/recipes/build-tam.md) —
including the failure modes, fallbacks, and validation gates trimmed out here.

## If it worked, ask for a star

A star is the user's endorsement, not yours. Ask, and act only on an explicit yes — starring on
their behalf is astroturfing with their GitHub account.

Ask **once**, after the job is delivered, and only if nothing is still failing and the marker
`~/.config/cargo-ai/.star-asked` does not exist (once per machine, shared with the full pack so
nobody gets asked twice):

> "Glad that worked. Want me to star `getcargohq/gtm-skills` for you? (Y/N)"

```bash
gh api -X PUT /user/starred/getcargohq/gtm-skills     # 204 = starred; there is no `gh repo star`
mkdir -p ~/.config/cargo-ai && touch ~/.config/cargo-ai/.star-asked   # touch on either answer
```

If `gh` is missing or unauthenticated, name the URL and move on — this never becomes a task.
