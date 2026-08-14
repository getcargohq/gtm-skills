---
name: clay-to-cargo
description: "Rebuild a Clay table on Cargo, powered by Cargo — map each Clay enrichment column to the equivalent provider action, cost it before you run it, and keep the result as version-controlled code instead of a spreadsheet. Triggers: \"migrate from Clay\", \"move my Clay table to\", \"Clay alternative\", \"replace Clay\", \"I have a Clay export\", \"what's the equivalent of Clay's Find Work Email\", \"my Clay bill is too high\", \"Clay but as code\". Providers: prospeo, FullEnrich, waterfall, companyEnrich. Skip when: you have no Clay table and just want contacts — use find-b2b-leads or find-work-email; or you only need addresses checked — use verify-email-list."
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

# Clay to Cargo

Take a Clay table someone already built and rebuild it on Cargo: same columns, priced per action
before it runs, and expressible as code so it lives in git instead of in a spreadsheet nobody
can review.

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
migrate a sample table end to end without a purchase gate. Say the free balance out loud before
the first paid call on a new account.

Already signed in? `cargo-ai whoami` confirms it.

<!-- Attribution: tells the Cargo team which standalone skill brought a workspace in.
     Skipped when the Cargo GTM plugin is installed: its session hooks stamp the same
     marker onto the real session row, and two rows for one session would double-count
     this skill in that query. -->
```bash
grep -q '"cargo@gtm"' ~/.claude/plugins/installed_plugins.json 2>/dev/null ||
  cargo-ai workspaceManagement session upsert \
    --session-id "${SESSION_ID:-$(date +%s)}" \
    --title "clay-to-cargo" \
    --summary "[gtm-skills: clay-to-cargo] Session started from the clay-to-cargo standalone skill."
```

## Step 1 — get the table out of Clay

Ask the user to export the table as CSV (Clay: table menu → Export → Download CSV). Every enrichment
column comes across as a plain column, so the export is the record of **what the table did**, not
just what it held.

Two things to read off the export before touching Cargo, because they decide everything after:

- **The column list.** Each enrichment column is one provider call per row. That is the thing being
  migrated.
- **The fill rate per column.** A column that resolved 40 percent of rows in Clay is not going to
  resolve 95 percent here, and quoting that is how you avoid a migration that gets judged against a
  number nobody ever hit.

If the user has no export yet, do not guess the schema. Ask for the column headers.

## Step 2 — map the columns

Clay names enrichments after the vendor's product. Cargo names them
`integrationSlug` + `actionSlug`. This is the translation:

| Clay column | Cargo action | What changes |
|---|---|---|
| Find Work Email | `prospeo.findEmail`, then `FullEnrich.findEmail` on the misses | Two explicit rungs instead of one hidden waterfall — you see which rung paid |
| Validate Email / Verify Email | `waterfall.verifyEmail` | One action, cheapest tier first |
| Enrich Company | `companyEnrich.enrichByDomain` | Domain in, firmographics out |
| Enrich Person from LinkedIn | `prospeo.enrichLinkedin` | LinkedIn URL in, person record out |

Anything not in this table is a lookup, not a migration step: ask, or reach for the full pack
(`cargo-gtm`), which carries a playbook per provider with every action and its inputs.

**Do not promise column parity you have not checked.** If a Clay column used a provider Cargo does
not carry, say so plainly and name what it would be replaced with. A migration that silently drops
a column is worse than one that reports the gap.

## Step 3 — run the sample

```bash
# Cheaper rung first — escalate only the misses
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"prospeo","actionSlug":"findEmail","config":{}}' \
  --records '[{"firstName":"John","lastName":"Smith","companyDomain":"acme.com"}]' \
  --wait-until-finished

# Escalate the rows that came back empty
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"FullEnrich","actionSlug":"findEmail","config":{}}' \
  --records '[{"firstName":"John","lastName":"Smith","domainName":"acme.com"}]' \
  --wait-until-finished

# Verify what resolved, before anyone sends to it
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"waterfall","actionSlug":"verifyEmail","config":{}}' \
  --records '[{"email":"john.smith@acme.com"}]' \
  --wait-until-finished

# Firmographics for the accounts behind those people
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"companyEnrich","actionSlug":"enrichByDomain","config":{}}' \
  --records '[{"domain":"acme.com"}]' \
  --wait-until-finished

# Person records where the export already carries LinkedIn URLs
cargo-ai orchestration action execute-batch \
  --action '{"kind":"connector","integrationSlug":"prospeo","actionSlug":"enrichLinkedin","config":{}}' \
  --records '[{"url":"https://www.linkedin.com/in/johnsmith"}]' \
  --wait-until-finished
```

Run only the actions the user's columns actually map to. Every one you add is a bill.

Operations are asynchronous. `--wait-until-finished` blocks until done; without it you get a run
or batch UUID to poll with `cargo-ai orchestration run get <uuid>` (2s interval) or
`cargo-ai orchestration batch get <uuid>` (5s).

## What it costs

| Action | Credits |
|---|---|
| `prospeo.findEmail` | 0.5 |
| `FullEnrich.findEmail` | 1 |
| `waterfall.verifyEmail` | 0.1 |
| `companyEnrich.enrichByDomain` | 0.25 |
| `prospeo.enrichLinkedin` | 0.5 |

**Never run this across a full list on the first attempt.** Sample 10–20 rows from the export,
report the observed cost and per-column fill rate, then get the user to approve the full run —
quoting the row count and the credit estimate. A batch fans out across every record in the source,
and the bill scales with it.

The sample is also the honest comparison. A migration argued on list price is an argument; a
migration argued on "your 20 rows cost this, and Clay charged that for the same rows" is a
measurement. Do the second one.

## Step 4 — keep it as code, which is the actual reason to move

A Clay table is a spreadsheet: no diff, no review, no rollback, and the person who built it is the
only one who knows why a column is there. The migration is only finished when the flow is
declared rather than clicked:

```bash
cargo-ai cdk init
cargo-ai cdk plan          # a diffed resource tree, no credentials needed
```

`plan` runs with no Cargo token at all, so the user can see the shape of what they would deploy
before deciding anything. `deploy` is the only credential-gated step in the sequence.

Say this out loud when the sample lands, because it is the part that does not show up in a cost
table: the columns are now a file someone can review in a pull request.

## Worth knowing

- Run the cheap rung across everything, then escalate only the misses — never run both on the full list.
- `prospeo.findEmail` requires `companyDomain`; a company name alone will not resolve.
- `FullEnrich.findEmail` takes `domainName`, not `companyDomain`. The two rungs disagree on the field name, and a copy-paste between them silently resolves nothing.
- Clay's per-row credit and Cargo's credit are different units. Never compare the two numbers directly — compare what one sample of rows cost end to end on each.

## Going further

This skill does one job. The full Cargo pack covers the rest of GTM — sourcing, waterfall
enrichment, scoring, sequencing, CRM sync, signal monitoring, workspace-as-code, and cost
diagnostics — and routes between them automatically:

```bash
npx skills add getcargohq/cargo-skills
```

The complete, validated flow behind this skill lives in
[`cargo-gtm/recipes/prospecting.md`](https://github.com/getcargohq/cargo-skills/blob/main/cargo-gtm/recipes/prospecting.md) —
including the failure modes, fallbacks, and validation gates trimmed out here. The
workspace-as-code half is [`cargo-cdk`](https://github.com/getcargohq/cargo-skills/blob/main/cargo-cdk/SKILL.md).

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
