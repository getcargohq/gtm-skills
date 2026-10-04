---
name: inbound-research
description: 'Every new inbound contact is researched within the quarter hour: the person and their company, a tier against your ICP and tiering rubric, and a three-sentence brief written back onto the record, then a note in Slack that mentions the owner. Triggers: "research every inbound lead as it comes in", "brief the owner on each demo request", "tier new inbound contacts", "when a form fill lands, tell us who it is", "qualify inbound leads automatically", "write a brief on every new signup". Cargo CDK, native contacts and accounts models, model.customColumn, definePlay, defineAgent, workspace context, webSearch, Slack postMessage; HubSpot, Salesforce or Attio as an adaptation. Skip when: you want one company researched now, in this chat, which is research-account; you want a list you already hold scored once, which is score-leads; or you want the whole TAM tiered, which is account-scoring.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.92 or later, a Cargo workspace, authorized Slack and Anthropic connectors, and a project context holding the ICP and the tiering rubric. No CRM needed; the crm-backed variation adds one."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/inbound-research
metadata:
  author: getcargo
  source: cookbook
  personas:
    - sales-development
    - revops
    - account-executive
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

# Inbound research

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

A demo request stops waiting in a queue for someone to look the person up. Every new inbound
contact is researched within fifteen minutes of landing, and three things happen:

1. **On the contact row**: `inbound_tier` (A, B, C or disqualified against your rubric),
   `inbound_brief` (who they are, what their company does, why they might be talking to you
   now), `inbound_rationale`, and `inbound_researched_at`.
2. **On the account row**: `tier` and `tier_reason`, only when the account has none
   yet. A tier set by `account-scoring` or by a rep is never overwritten by one inbound lead.
3. **In Slack**: one note to a fixed channel with the brief, the tier, the rationale and the
   sources, mentioning the contact's owner.

The worked example runs on two Cargo native models, `gtm_contacts` and `gtm_accounts`, so it
needs no CRM. **New contacts land in `gtm_contacts` from whatever captures your inbound**: a
form or webhook posting into the model, a CSV upload, `cargo-ai storage record create`, or another
pipeline. A play runs on each row added since its last tick whose `lead_source` is one of your
inbound sources and that has never been researched. An agent reads the ICP and the tiering rubric
from the workspace context, researches with web search, and hands back JSON; the play writes it
onto the native record ids with `model.customColumn` and posts the note. The agent writes nothing
itself.

It does not assign, route or reassign anyone, and it never contacts the lead. Running HubSpot,
Salesforce or Attio? The `crm-backed` variation swaps the native models for the CRM and writes back
by CRM record id.

## Example

> Research every new inbound contact, tier it against our ICP, and tell the owner in #inbound.

Illustrative output, fictional records:

```text
:inbox_tray: *Dana Ruiz*, VP Revenue Operations (dana@fabrikam.example) — tier *A*
Dana runs RevOps at Fabrikam, a 240-person freight-audit software company selling
to mid-market shippers. They hired a Head of Data last week and their careers page
lists two routing roles, which reads as a team rebuilding lead flow now.
_Fits the ICP on size and B2B software; the persona is employed and the practice is
visible in public, which is the rubric's bar for A._
Owner: @sam · Source: demo_request
Sources: fabrikam.example/about · fabrikam.example/careers · fabrikam.example/news/head-of-data
```

Over a week, 41 inbound contacts were researched: 6 A, 13 B, 15 C and 7 disqualified (three
students, two vendors, two competitors), each with the brief on its row.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it — the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/inbound-research` writes this example to `infra/inbound-research/` and
   this procedure to `.claude/skills/inbound-research/`. No project yet?
   `cargo-ai cdk init <dir> --cookbook inbound-research && cd <dir> && npm install` does both. **If
   you are reading this from the project's `.claude/skills/`, the install already happened — start
   at step 2.** On a CLI too old to have `add`, copy this folder in as a sibling of what is there by
   hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** If the project already has native contacts or
   accounts models, a Slack or an Anthropic connector, rewire the imports to the existing one and
   drop the copy; two resources with one slug is a collision at deploy. If the team works in a CRM,
   apply `crm-backed` now, before the first deploy. Put `context/tiering-rubric.md` in the project's
   context beside `icp.md`, unless account-scoring already put it there, in which case keep that
   one.
3. **Decide how contacts arrive.** Name the capture that writes into `gtm_contacts` (a form
   posting to it, a webhook, an upload, another pipeline) and the `lead_source` value it writes.
   Those values are the play's allow-list.
4. **Fix the Slack channel and the owner map** in `infra/plays/research-inbound.ts`: a channel id
   (`C…`) from the Slack connector's autocomplete, with the bot invited, and `owner_id` to Slack
   user id for each owner. `references/note.md` is the note shape.
5. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about; _What you can change_ is what you offer unprompted; _What you will be asked_ is the
   floor, and you derive before you ask. If you are asking more than about four questions you have
   skipped lookups. Record what you changed and why under a `## Decisions` section in your copy of
   this file.
6. **Check, plan, deploy disabled.** `node --import tsx evals/contract.mjs` from this skill's
   folder, then `npm run check && cargo-ai cdk plan` from the project root. Show the diff, and
   deploy only on an explicit yes: `cargo-ai cdk deploy`. The play ships with `isEnabled: false`.
7. **Pilot, then enable.** Seed one test contact with `cargo-ai storage record create`, run the
   play by hand, read the brief and the tier against the sources, then pilot ten real inbound
   contacts the same way. Enable only after that. `changeKinds: ["added"]` does not backfill what
   landed while it was off.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the ones marked
_asked_ genuinely live in the operator's head.

| Input                                                   | Kind    | How it is answered                                                                                                                                        | Why it matters                                                                                                                              |
| ------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| where contacts come from                                | asked   | The form, webhook, upload or pipeline that writes into `gtm_contacts`. If the team runs a CRM, that is `crm-backed` instead.                          | Without a capture the model stays empty and the play reports zero runs, which reads as a quiet week.                                         |
| inbound `lead_source` values (`infra/plays/research-inbound.ts`) | derived | Count `lead_source` values in the model once rows exist; the capture's own config says what it writes. Set them as the allow-list.                          | A value missing from the list is never researched. A deny-list instead would research a sourced list loaded into the same model, at inbound cost. |
| ICP and tiering rubric                                  | derived | Read `icp.md` and `tiering-rubric.md` from the project context. If the rubric is missing, copy this skill's and fill its placeholders with the operator. | They are the whole judgment. With neither, the agent tiers on a plausible ICP it invented.                                                  |
| Slack channel (`infra/plays/research-inbound.ts`)       | asked   | A channel id (`C…`) from the Slack connector's autocomplete. Invite the bot.                                                                              | The note carries a tier and a rationale about a named person. Fixed so it never lands in a customer shared channel.                          |
| owner map (`infra/plays/research-inbound.ts`)           | asked   | `owner_id` values from the model, Slack ids from the Slack `listUsers` action; the operator confirms who is who.                                         | An unmapped owner is named by id, not mentioned, and does not get notified.                                                                 |

## What you can change

| Variation         | When it is right                                                     | How                                                                                                                                                                                                                                                                                                                                                                                            | What it costs                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crm-backed`      | Inbound lands in HubSpot, Salesforce or Attio and the brief belongs there | Add the CRM connector (`default: true`). Replace `gtm_contacts` with a connector-backed model (`fetchRecords`, `objectType: "contacts"`, `columnSelectionMode: "all"`, no config filter, a 30-minute cron) and drop `gtm_accounts`. Create the properties `inbound_tier`, `inbound_brief`, `inbound_rationale` (text) and `inbound_researched_at` (date) on contacts, `tier` and `tier_reason` on companies. In the workflow, replace each `model.customColumn` with the CRM's `updateRecords` matched on the record id the row came with (`hs_object_id` on HubSpot), `skipIfExist: true` on the tier fields; filter on the CRM's source column (`hs_analytics_source` not `OFFLINE` on HubSpot). Update the contract's no-CRM assertion. | A second system to authorize and a CRM sync interval (thirty minutes on HubSpot) between a form fill and its research. Only the native shape is checked here: re-run the pilot of ten. |
| `form-only`       | Only demo-request fills should be researched                         | Narrow the `lead_source` allow-list to the demo-request value                                                                                                                                                                                                                                                                                                                                  | Signups and content downloads go unresearched. Say so to the team, or they read silence as "not worth it".                                                                            |
| `a-and-b-only`    | The channel is too busy                                              | In the workflow, post only when the tier is `A` or `B`; still write every tier                                                                                                                                                                                                                                                                                                                | C and disqualified leads are only visible on the row. A wrong `C` stops being noticed.                                                                                               |
| `no-account-tier` | account-scoring owns the account tier and inbound must not seed it   | Drop the accounts `customColumn` block                                                                                                                                                                                                                                                                                                                                                         | An account with no tier stays untiered until the scoring play reaches it.                                                                                                            |

## What should not change

- **The write targets the record id the row came with.** (`infra/plays/research-inbound.ts`) A
  unification step or a match on email between the row and the write makes the run look successful
  while nothing lands, or lands on a duplicate. On `crm-backed`, that id is the CRM record id.
- **Writes use bare slugs.** (`infra/plays/research-inbound.ts`) `model.customColumn` nests the slug
  under `custom` itself; the `custom__` name the read side shows is dropped while the node still
  reports success.
- **The agent judges; the play writes.** (`infra/agents/researcher.ts`) No connector action or
  writable model is on the agent. An agent that could write decides its own routing, and a missing
  brief could then be a failed run, a skip, or a choice.
- **The judgment and the stamp land on one write.** A contact is never marked researched without
  carrying the research, and a failed write leaves the stamp blank so the next tick retries it.
- **The account tier is never overwritten.** One inbound lead is less evidence than the scoring
  play or a rep had. Overwriting would let a student's form fill downgrade a tier-A account.
- **`changeKinds: ["added"]` and the `researched_at` blank test both stay.** Drop the first and
  every tick re-researches the whole table; drop the second and re-enabling the play pays for every
  contact again.
- **`lead_source` is an allow-list.** A list of sourced or imported contacts landing in the same
  model must not be researched at inbound cost.
- **Ownership is not touched.** No assignment, no rotation, no reassignment. Routing is a separate
  decision with its own rules, and a research step that quietly changes owners is how leads get
  lost between reps.
- **The rubric lives in the context, not in the prompt.** Changing what tier A means is a reviewed
  commit, and the same file tiers sourced accounts and inbound leads.

## Done when

- `node --import tsx evals/contract.mjs` passes
- `cargo-ai cdk plan` reports the two native models, the agent, the play (disabled), the two
  connectors and the three folders
- a test contact seeded with `cargo-ai storage record create` (an inbound `lead_source`, a work
  email, an `account_id` pointing at a seeded account with no tier) was researched by a manual run:
  all four contact columns are set, the account got `tier`, and one note landed in the
  `references/note.md` shape
- a second manual run over the same contact wrote nothing and posted nothing
- a contact seeded with a `lead_source` outside the allow-list was not researched
- an account that already had `tier` kept it
- every fact in a sampled brief is in the record or on a listed source page
- after enabling, a contact written by the real capture was researched within fifteen minutes, once

## What it costs

Each researched contact is one agent run, billed as LLM tokens through the Anthropic connector plus
up to four web searches, two native model writes and one Slack post. Native model reads and writes
bill nothing per record. Immediately before the plan, read the live price of the Slack action:

- `cargo-ai orchestration action list postMessage --kind connector --integration-slug slack`

Say it out loud, estimate last month's inbound volume from the capture, and confirm before enabling.

## Composes into

`account-scoring` (the same rubric tiers the TAM; inbound fills a blank account tier until scoring
reaches it), `agentic-engagement` (holds the conversation once the owner replies), and
`meeting-prep` (the brief is there when the first call is booked).
