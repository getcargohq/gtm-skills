---
name: inbound-research
description: 'Every new inbound contact in HubSpot is researched within the hour: the person and their company, a tier against your ICP and tiering rubric, and a three-sentence brief written back onto the CRM record, then a note in Slack that mentions the owner. Triggers: "research every inbound lead as it comes in", "brief the owner on each demo request", "tier new inbound contacts in hubspot", "when a form fill lands, tell us who it is", "qualify inbound leads automatically", "write a brief on every new signup into the CRM". Cargo CDK, HubSpot fetchRecords, updateRecords, definePlay, defineAgent, workspace context, webSearch, Slack postMessage. Skip when: you want one company researched now, in this chat, which is research-account; you want a list you already hold scored once, which is score-leads; or you want the whole TAM tiered, which is account-scoring.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.92 or later, a Cargo workspace, authorized HubSpot, Slack and Anthropic connectors, and a project context holding the ICP and the tiering rubric."
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

A demo request stops waiting in a queue for someone to look the person up. Every new contact that
arrives in HubSpot through an online channel is researched within the hour, and three things land:

1. **On the contact**: `cargo_inbound_tier` (A, B, C or disqualified against your rubric),
   `cargo_inbound_brief` (who they are, what their company does, why they might be talking to you
   now), `cargo_inbound_rationale`, and `cargo_inbound_researched_at`.
2. **On the company**: `cargo_tier` and `cargo_tier_reason`, only when the company has none yet. A
   tier set by `account-scoring` or by a rep is never overwritten by one inbound lead.
3. **In Slack**: one note to a fixed channel with the brief, the tier, the rationale and the
   sources, mentioning the HubSpot owner.

A model extracts every HubSpot contact every thirty minutes. A play runs on the rows that are new
since the last sync, came in through an online source, and have never been researched. For each,
an agent reads the ICP and the tiering rubric from the workspace context, researches with web
search, and hands back JSON; the play writes it onto the HubSpot record id the row came with and
posts the note. The agent writes nothing itself.

It does not assign, route or reassign anyone, and it never contacts the lead. Ownership stays where
HubSpot put it.

## Example

> Research every new inbound contact in HubSpot, tier it against our ICP, and tell the owner in #inbound.

Illustrative output, fictional records:

```text
:inbox_tray: *Dana Ruiz*, VP Revenue Operations at Fabrikam — tier *A*
Dana runs RevOps at Fabrikam, a 240-person freight-audit software company selling
to mid-market shippers. They hired a Head of Data last week and their careers page
lists two routing roles, which reads as a team rebuilding lead flow now.
_Fits the ICP on size and B2B software; the persona is employed and the practice is
visible in public, which is the rubric's bar for A._
Owner: @sam · Source: ORGANIC_SEARCH
Sources: fabrikam.example/about · fabrikam.example/careers · fabrikam.example/news/head-of-data
```

Over a week, 41 inbound contacts were researched: 6 A, 13 B, 15 C and 7 disqualified (three
students, two vendors, two competitors), each with the brief on the HubSpot record.

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
2. **Reconcile it with what is already declared.** If the project already has a HubSpot, Slack or
   Anthropic connector, or a HubSpot contacts model, rewire the imports to the existing one and
   drop the copy; two resources with one slug is a collision at deploy. Put
   `context/tiering-rubric.md` in the project's context beside `icp.md`, unless account-scoring
   already put it there, in which case keep that one.
3. **Create the HubSpot properties.** On contacts: `cargo_inbound_tier`, `cargo_inbound_brief`,
   `cargo_inbound_rationale` (text) and `cargo_inbound_researched_at` (date). On companies:
   `cargo_tier` and `cargo_tier_reason`, unless account-scoring already created them. Check with the
   HubSpot `listObjectProperties` autocomplete; a write to a property that does not exist fails.
4. **Fix the Slack channel and the owner map** in `infra/plays/research-inbound.ts`: a channel id
   (`C…`) from the Slack connector's autocomplete, with the bot invited, and HubSpot owner id to
   Slack user id for each owner. `references/note.md` is the note shape.
5. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about; _What you can change_ is what you offer unprompted; _What you will be asked_ is the
   floor, and you derive before you ask. If you are asking more than about four questions you have
   skipped lookups. Record what you changed and why under a `## Decisions` section in your copy of
   this file.
6. **Check, plan, deploy disabled.** `node --import tsx evals/contract.mjs` from this skill's
   folder, then `npm run check && cargo-ai cdk plan` from the project root. Show the diff, and
   deploy only on an explicit yes: `cargo-ai cdk deploy`. The play ships with `isEnabled: false`.
7. **Pilot, then enable.** Wait for the first model sync, run the play by hand on ten recent inbound
   contacts, read every brief and tier against the CRM and the sources, and only then enable the
   play. `changeKinds: ["added"]` does not backfill what landed while it was off.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the ones marked
_asked_ genuinely live in the operator's head.

| Input                                                   | Kind    | How it is answered                                                                                                                                                                         | Why it matters                                                                                                                                         |
| ------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HubSpot connector (`infra/connectors/hubspot.ts`)       | value   | **derived**: `cargo-ai connection connector list`. `default: true` binds it.                                                                                                               | It is both the source and the write target. Without it nothing syncs, and the play reports zero runs, which reads as a quiet week.                       |
| what counts as inbound (`infra/plays/research-inbound.ts`) | derived | Count contacts by `hs_analytics_source` in the first sync. `OFFLINE` (imports, integrations, typed by a rep) is excluded by default.                                                        | A portal where demo requests arrive through an integration marked `OFFLINE` researches nothing until the filter names that integration instead.            |
| ICP and tiering rubric                                  | derived | Read `icp.md` and `tiering-rubric.md` from the project context. If the rubric is missing, copy this skill's and fill its placeholders with the operator.                                   | They are the whole judgment. With neither, the agent tiers on a plausible ICP it invented.                                                            |
| HubSpot properties                                      | derived | `listObjectProperties` on contacts and companies; create the missing ones.                                                                                                                 | A write to a missing property fails the run after the research was paid for.                                                                          |
| Slack channel (`infra/plays/research-inbound.ts`)       | asked   | A channel id (`C…`) from the Slack connector's autocomplete. Invite the bot.                                                                                                               | The note carries a tier and a rationale about a named person. Fixed so it never lands in a customer shared channel.                                     |
| owner map (`infra/plays/research-inbound.ts`)           | asked   | HubSpot owner ids from the `listUsers` autocomplete, Slack ids from Slack `listUsers`; the operator confirms who is who.                                                                   | An unmapped owner is named by id, not mentioned, and does not get notified.                                                                            |

## What you can change

| Variation         | When it is right                                                       | How                                                                                                                                    | What it costs                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form-only`       | Only demo-request or contact-form fills should be researched           | Add a condition on `recent_conversion_event_name` (or your form property) to the play filter                                           | Signups and content downloads go unresearched. Say so to the team, or they read silence as "not worth it".                                               |
| `a-and-b-only`    | The channel is too busy                                                | In the workflow, post only when the tier is `A` or `B`; still write every tier to HubSpot                                              | C and disqualified leads are only visible in HubSpot. A wrong `C` stops being noticed.                                                                  |
| `no-company-tier` | account-scoring owns the company tier and inbound must not seed it     | Drop the companies `updateRecords` block                                                                                              | A company with no tier stays untiered until the scoring play reaches it.                                                                                 |
| `salesforce`      | The CRM is Salesforce or Attio                                         | Change the connector, the extractor config, `hs_object_id` to the record id, the source column, and the write action                   | Only the HubSpot shape is checked. Re-run the pilot of ten before enabling.                                                                              |

## What should not change

- **The write targets the record id the row came with.** (`infra/plays/research-inbound.ts`) A
  unification step or a match on email between the extract and the write makes the run look
  successful while nothing lands, or lands on a duplicate.
- **The agent judges; the play writes.** (`infra/agents/researcher.ts`) No CRM, Slack or writable
  model is on the agent. An agent that could write decides its own routing, and a missing brief
  could then be a failed run, a skip, or a choice.
- **Fill-blank on the judgment, always on the stamp.** (`infra/plays/research-inbound.ts`)
  `skipIfExist` keeps a rep's hand-set tier and an earlier brief. The `researched_at` stamp always
  lands, because it is what keeps the contact from being researched again.
- **The company tier is never overwritten.** One inbound lead is less evidence than the scoring
  play or a rep had. Overwriting would let a student's form fill downgrade a tier-A account.
- **`changeKinds: ["added"]` and the `researched_at` blank test both stay.** Drop the first and
  every sync re-researches the whole portal; drop the second and re-enabling the play pays for
  every contact again.
- **Ownership is not touched.** No assignment, no rotation, no reassignment. Routing is a separate
  decision with its own rules, and a research step that quietly changes owners is how leads get
  lost between reps.
- **The rubric lives in the context, not in the prompt.** Changing what tier A means is a reviewed
  commit, and the same file tiers sourced accounts and inbound leads.

## Done when

- `node --import tsx evals/contract.mjs` passes
- `cargo-ai cdk plan` reports the model, the agent, the play (disabled), the three connectors and
  the three folders
- the first sync landed every contact with `hs_object_id`, `email` and `hs_analytics_source`
  populated
- a pilot of ten recent inbound contacts wrote all four contact properties on each, set the company
  tier only where it was blank, and posted ten notes in the `references/note.md` shape
- every fact in a sampled brief is in the CRM record or on a listed source page
- a second manual run over the same ten wrote nothing and posted nothing
- a contact created by a rep (`OFFLINE`) during the pilot was not researched
- after enabling, a test form fill was researched within an hour of submission

## What it costs

Each researched contact is one agent run, billed as LLM tokens through the Anthropic connector plus
up to four web searches, and two or three HubSpot calls and one Slack post. Immediately before the
plan, read the live price of each connector action:

- `cargo-ai orchestration action list updateRecords --kind connector --integration-slug hubspot`
- `cargo-ai orchestration action list postMessage --kind connector --integration-slug slack`

Say each number out loud, multiply by last month's inbound volume (count `hs_analytics_source` not
`OFFLINE` in the first sync), and confirm before enabling. The model sync itself bills nothing per
record.

## Composes into

`account-scoring` (the same rubric tiers the TAM; inbound fills a blank company tier until scoring
reaches it), `agentic-engagement` (holds the conversation once the owner replies), and
`meeting-prep` (the brief is on the contact when the first call is booked).
