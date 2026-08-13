---
name: find-linkedin-url
description: "Resolve a person's LinkedIn profile URL from their name and company, with an identity-validation gate that rejects wrong matches, powered by Cargo. Triggers: \"find the LinkedIn for John Smith at Acme\", \"get LinkedIn URLs for these contacts\", \"what's this person's LinkedIn\", \"add LinkedIn profiles to my list\". Providers: linkedin. Skip when: you already have the LinkedIn URL and want the profile data — use enrich-linkedin-profile."
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

# Find LinkedIn URL

Resolve a person's LinkedIn profile URL from their name and company, with an identity-validation gate that rejects wrong matches.

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
    --title "find-linkedin-url" \
    --summary "[gtm-skills: find-linkedin-url] Session started from the find-linkedin-url standalone skill."
```

## Do the job

```bash
# 1. Resolve a candidate URL
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"linkedin","actionSlug":"findProfileUrl","config":{}}' \
  --records '[{"fullName":"John Smith","companyName":"Acme"}]' \
  --wait-until-finished > candidates.json

# 2. Validate it — enrich the candidate and confirm the company matches
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"linkedin","actionSlug":"enrichProfile","config":{}}' \
  --records "$(jq -c '[.results[] | {linkedinUrl: .url}]' candidates.json)" \
  --wait-until-finished
```

A validated LinkedIn URL per contact, with unresolved rows marked explicitly.

Operations are asynchronous. `--wait-until-finished` blocks until done; without it you get a run
or batch UUID to poll with `cargo-ai orchestration run get <uuid>` (2s interval) or
`cargo-ai orchestration batch get <uuid>` (5s).

## What it costs

| Action | Credits |
|---|---|
| `linkedin.findProfileUrl` | 0.25 |
| `linkedin.enrichProfile` | 0.25 |

**Never run this across a full list on the first attempt.** Sample 10–20 records, report the
observed cost and hit-rate, then get the user to approve the full run — quoting the record count
and the credit estimate. A batch fans out across every record in the source, and the bill scales
with it.

## Worth knowing

- Step 2 is not optional. Unvalidated resolution runs ~50% accurate because of same-name collisions; validated it is ~80%.
- Reject rather than guess — never write back a low-confidence URL.

## Going further

This skill does one job. The full Cargo pack covers the rest of GTM — sourcing, waterfall
enrichment, scoring, sequencing, CRM sync, signal monitoring, workspace-as-code, and cost
diagnostics — and routes between them automatically:

```bash
npx skills add getcargohq/cargo-skills
```

The complete, validated flow behind this skill lives in
[`cargo-gtm/recipes/linkedin-url-lookup.md`](https://github.com/getcargohq/cargo-skills/blob/main/cargo-gtm/recipes/linkedin-url-lookup.md) —
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
