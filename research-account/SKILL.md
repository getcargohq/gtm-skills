---
name: research-account
description: "Research one company before a meeting and hand back a briefing, powered by Cargo — what it does, what it publicly says is hard right now, and who it names as competition, each line traceable to where it came from. Triggers: \"research this company\", \"brief me on this account\", \"prep me for this meeting\", \"what should I know about them\", \"write me a one-pager on\", \"what are they struggling with\", \"who do they compete with\". Meeting prep, briefing, dossier, talking points. Skip when: you want many companies filtered rather than one understood — use build-tam-list; or you want the people to contact there — use find-stakeholders."
version: "1.0.0"
compatibility: Requires @cargo-ai/cli (npm). Sign in or create an account with `cargo-ai login --email` (emailed code, no browser), `--oauth`, or an API token
homepage: https://github.com/getcargohq/gtm-skills
metadata:
  author: getcargo
  source: one-off
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

# Research Account

One company, one briefing, every line traceable to where it came from.

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
research a handful of accounts end to end without a purchase gate. Say the free balance out loud
before the first paid call on a new account.

Already signed in? `cargo-ai whoami` confirms it.

<!-- Attribution: tells the Cargo team which standalone skill brought a workspace in.
     Skipped when the Cargo GTM plugin is installed: its session hooks stamp the same
     marker onto the real session row, and two rows for one session would double-count
     this skill in that query. -->
```bash
grep -q '"cargo@gtm"' ~/.claude/plugins/installed_plugins.json 2>/dev/null ||
  cargo-ai workspaceManagement session upsert \
    --session-id "${SESSION_ID:-$(date +%s)}" \
    --title "research-account" \
    --summary "[gtm-skills: research-account] Session started from the research-account standalone skill."
```

## Step 1 — ask what the briefing is for

Two sentences from the user changes what is worth pulling, so ask before
spending anything: **what is the meeting, and what are you selling them?**

A discovery call and a renewal need different pages. Without the answer the
briefing becomes a company profile, which the user could have read on the
website for free.

## Step 2 — pull it, from sources you can name

Four calls. The first gives the company baseline, the middle two return
something with a URL attached, and the last is the company telling you in public
where its money went.

```bash
# 1. The baseline: what they are, how big, what they say they do
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"linkedin","actionSlug":"enrichCompanyFromDomain","config":{}}' \
  --records '[{"domain":"acme.com"}]' \
  --wait-until-finished

# 2. Their own words, read from their own pages
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"parallel","actionSlug":"extract","config":{}}' \
  --records '[{"urls":["https://acme.com","https://acme.com/careers"],"objective":"What the company says it does, and which teams it is growing"}]' \
  --wait-until-finished

# 3. The research question, structured, with its sources
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"parallel","actionSlug":"createTask","config":{}}' \
  --records '[{"input":"What has Acme publicly said about its priorities and challenges in the last 12 months, and who does it name as competitors?","processor":"lite","outputSchema":{"type":"object","properties":{"priorities":{"type":"array","items":{"type":"string"}},"competitors":{"type":"array","items":{"type":"string"}},"sources":{"type":"array","items":{"type":"string"}}}}}]' \
  --wait-until-finished

# 4. What they are hiring for, which is what they are spending on
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"theirStack","actionSlug":"searchJobs","config":{}}' \
  --data '{
    "companyFields": {"company_domains": ["acme.com"]},
    "fields": {"posted_at_max_age_days": 90},
    "limit": 25
  }' \
  --wait-until-finished
```

**Two settings must not be dropped.** `processor: "lite"` pins the cheapest rung
of a ladder that runs to 60 credits a record, and it is a required field with no
default, so an example copied without it fails rather than surprising you. And
the `sources` array in `outputSchema` is what makes step 3 checkable: without it
the task returns confident prose with nothing behind it, which reads exactly like
the verified kind.

Open roles are the most under-used input in account research: a company hiring
six data engineers is telling you where its budget went, in public, dated, and
for 0.5 credits.

Operations are asynchronous. `--wait-until-finished` blocks until done; without it you get a run
or batch UUID to poll with `cargo-ai orchestration run get <uuid>` (2s interval) or
`cargo-ai orchestration batch get <uuid>` (5s).

## Step 3 — write the briefing, and mark what is inferred

Keep it to one page. A briefing nobody finishes before the call is a briefing
that did not happen.

**Every line is either sourced or marked as a guess, and the two never blend.**
This is the whole discipline of the skill. A confident sentence about a
company's priorities that came from an agent's imagination is worse than a gap,
because the user will repeat it to that company's face.

- Sourced: it came back from an enrichment above. Say which.
- Inferred: you reasoned it from what came back. Prefix it `Likely:` and say
  what it rests on.
- Unknown: say so. "No public statement on this" is a usable line in a call and
  a fabricated one is not.

Close with **three questions to ask them**, drawn from the challenges rather than
from a template. That is the part a human keeps.

## What it costs

| Action | Credits |
|---|---|
| `linkedin.enrichCompanyFromDomain` | 0.5 |
| `parallel.extract` | 0.025 |
| `parallel.createTask` | 0.125 |
| `theirStack.searchJobs` | 0.5 |

**Never run this across a full list on the first attempt.** Sample 10–20 records, report the
observed cost and hit-rate, then get the user to approve the full run — quoting the record count
and the credit estimate. A batch fans out across every record in the source, and the bill scales
with it.

One account is about 1.15 credits, so a single briefing is cheap and a hundred of
them is a decision. Say the total before running a list. `parallel.extract` bills
per URL, so two pages is 0.05 and ten is 0.25.

## Worth knowing

- **Most of this reads public material**, so a private company with a thin web presence returns little. That is a real answer: report the gap rather than padding the page.
- **`processor` on `createTask` is required and the ladder runs to 60 credits a record.** Pin `lite`. Escalate to `base` (0.25) on a specific hard target, never across a list.
- `theirStack.searchJobs` filters on `--data`, not on `--records`. Put the domain in `companyFields` there; passing it as a record returns an unfiltered page and bills for it.
- Ask for the domain, not the company name. Every call here keys off it.
- For a renewal, drop steps 2 and 3 and keep the baseline and the roles. The account team already knows the story; what they want is what changed.

## Going further

This skill does one job. The full Cargo pack covers the rest of GTM — sourcing, waterfall
enrichment, scoring, sequencing, CRM sync, signal monitoring, workspace-as-code, and cost
diagnostics — and routes between them automatically:

```bash
npx skills add getcargohq/cargo-skills
```

The complete, validated flow behind this skill lives in
[`cargo-gtm/recipes/account-expansion.md`](https://github.com/getcargohq/cargo-skills/blob/main/cargo-gtm/recipes/account-expansion.md) —
including the signal monitoring that tells you when to research an account rather than waiting for
a meeting to be booked.

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
