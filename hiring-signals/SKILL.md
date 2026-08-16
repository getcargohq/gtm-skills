---
name: hiring-signals
description: "Find companies that are hiring for a role, and treat the job posting as the buying signal it is, powered by Cargo. Triggers: \"hiring signals\", \"who is hiring\", \"companies hiring data engineers\", \"job postings as intent\", \"find accounts building a team\", \"they just posted a role\", \"hiring intent data\". Providers: theirStack. Skip when: you want companies by the software they already run rather than the roles they are opening — use find-companies-using-tech; or you want the people inside one account — use find-stakeholders."
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

# Hiring Signals

A company opening a role is telling you what it is about to spend money on. Find the postings,
and you have found the accounts that are building the thing you sell into.

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
    --title "hiring-signals" \
    --summary "[gtm-skills: hiring-signals] Session started from the hiring-signals standalone skill."
```

## Do the job

The postings themselves, which is the signal at its freshest:

```bash
cargo-ai orchestration action execute \
  --action '{"kind":"connector","integrationSlug":"theirStack","actionSlug":"searchJobs","config":{}}' \
  --data '{"job_title_or":["data engineer","analytics engineer"],"posted_at_max_age_days":30,"limit":25}' \
  --wait-until-finished
```

The accounts behind them, when you want the company list rather than the postings:

```bash
cargo-ai orchestration action execute \
  --action '{"kind":"connector","integrationSlug":"theirStack","actionSlug":"searchCompanies","config":{}}' \
  --data '{"job_title_or":["data engineer"],"company_country_code_or":["US"],"limit":25}' \
  --wait-until-finished
```

Operations are asynchronous. `--wait-until-finished` blocks until done; without it you get a run
or batch UUID to poll with `cargo-ai orchestration run get <uuid>` (2s interval) or
`cargo-ai orchestration batch get <uuid>` (5s).

## What it costs

| Action | Credits |
|---|---|
| `theirStack.searchJobs` | 0.5 |
| `theirStack.searchCompanies` | 0.5 |

**Never run this across a full list on the first attempt.** Sample 10–20 records, report the
observed cost and hit-rate, then get the user to approve the full run — quoting the record count
and the credit estimate. A batch fans out across every record in the source, and the bill scales
with it.

## Worth knowing

- **Age the signal.** A role posted 90 days ago is a role nobody filled or a role already filled,
  and neither is the moment you wanted. `posted_at_max_age_days` is the field that makes this a
  signal rather than a directory.
- **The posting names the stack.** A job description lists the tools the team runs, so a hiring
  search doubles as a technographic one without a second provider.
- **Hiring is a trigger, not a qualification.** It tells you the team is being built; it does not
  tell you they have budget, authority, or a problem you solve. Pair it with fit before anyone is
  contacted.

## Going further

This skill does one job. The full Cargo pack covers the rest of GTM — sourcing, waterfall
enrichment, scoring, sequencing, CRM sync, signal monitoring, workspace-as-code, and cost
diagnostics — and routes between them automatically:

```bash
npx skills add getcargohq/cargo-skills
```

The complete, validated flow behind this skill lives in
[`cargo-gtm/provider-playbooks/theirStack.md`](https://github.com/getcargohq/cargo-skills/blob/main/cargo-gtm/provider-playbooks/theirStack.md) —
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
