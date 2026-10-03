---
name: expansion-signals
description: 'Every week the CRM customers coming up on renewal are judged for an expansion moment — purchase cadence, last price paid, and dated outside events such as funding, hiring or a new leader — and the signal and its reason are written onto the HubSpot company, then posted as one digest for the customer team. Triggers: "flag customers ready to expand", "which customers should we upsell this quarter", "renewal and expansion signals every week", "tell account managers which accounts to call before renewal", "find expansion opportunities in our customer base", "at-risk renewals digest in slack". Cargo CDK, HubSpot companies and deals, fetchRecords, updateRecords, definePlay, defineAgent, webSearch, workspace context, Slack postMessage. Skip when: you want to know who raised money across a list of prospects, which is track-funding-rounds; or you want to watch target accounts for buying signals before they are customers, which is monitor-buying-signals.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.92 or later, a Cargo workspace, authorized HubSpot, Slack and Anthropic connectors, and three custom HubSpot company properties (`cargo_expansion_signal`, `cargo_expansion_reason`, `cargo_expansion_signal_at`). Reads the workspace context when the project declares one."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/expansion-signals
metadata:
  author: getcargo
  source: cookbook
  personas:
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

# Expansion signals

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

The renewal stops being the first time anyone looks at a customer. Every Monday:

1. **A play selects the customers in their renewal window** from a HubSpot company model:
   `lifecyclestage` is `customer`, the most recent deal closed ten to twelve months ago, and the
   account has not been judged in the last sixty days.
2. **An agent judges each one.** It reads the company's deal history (cadence, last price paid),
   your expansion plays from the workspace context, and up to three web searches for dated public
   events. It answers `renewal`, `expansion`, `repeat_purchase`, `at_risk` or `none`, with a reason
   of at most three sentences, the play to run, and every URL it relied on.
3. **The play writes the judgment onto the HubSpot company**, matched on `hs_object_id`:
   `cargo_expansion_signal`, `cargo_expansion_reason` and a `cargo_expansion_signal_at` stamp. It
   writes nothing else: no deal, no contact, no owner.
4. **One digest lands in Slack** that afternoon, once the hourly sync has carried the writes back:
   at-risk accounts first, then expansion, repeat purchase and plain renewal, each with the reason
   as written on the record and its owner. A ledger keeps it to one post a week.

The account manager reads the same words in Slack and on the CRM record, and every claim carries
its source.

## Example

> Every Monday, flag which customers near renewal are ready to expand and post the digest to #cs-weekly.

Illustrative output, fictional records:

```text
:seedling: *Expansion signals, week of 2026-10-05*
_6 accounts in their renewal window: 1 at risk, 2 ready to expand._

*Tailspin Logistics* (tailspin.example) · at_risk · New CDO joined Sep 22 from a
  competitor's customer; renewed every 12 months, last at 24,000. Play: executive
  check-in. Sources: tailspin.example/news/new-cdo · owner 4411
*Fabrikam* (fabrikam.example) · expansion · Raised a Series B on Sep 9 and posted
  four data-engineer roles; renewed every 12 months, last at 38,000. Play: annual
  prepay offer. Sources: fabrikam.example/press/series-b · owner 4402
*Northwind Traders* (northwind.example) · expansion · Hired a Head of Compliance on
  Sep 30. Play: governance add-on demo. Sources: northwind.example/team · owner 4402
*Contoso* (contoso.example) · repeat_purchase · Ordered every 6 months, last at
  9,500 on Apr 2. Play: renewal call at the last price. · owner 4419
*Litware* (litware.example) · renewal · No outside event. · owner 4411
```

Six customers were judged and six HubSpot companies carry the signal and reason; a seventh, judged
three weeks ago, was skipped by the sixty-day rule.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it — the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/expansion-signals` writes this example to `infra/expansion-signals/`
   and this procedure to `.claude/skills/expansion-signals/`. No project yet?
   `cargo-ai cdk init <dir> --cookbook expansion-signals && cd <dir> && npm install` does both.
   **If you are reading this from the project's `.claude/skills/`, the install already happened —
   start at step 2.**
2. **Reconcile it with what is already declared.** If the project already has a HubSpot, Slack or
   Anthropic connector, or a HubSpot companies or deals model (`crm-enrichment` declares one), rewire
   the imports to the existing one and drop the copy; two resources with one slug is a collision at
   deploy.
3. **Create the three HubSpot properties** on companies: `cargo_expansion_signal` (single-line
   text), `cargo_expansion_reason` (multi-line text) and `cargo_expansion_signal_at` (date). A write
   to a property that does not exist fails every row.
4. **Write your expansion plays** into the workspace context. `references/expansion-plays.md` is the
   example; copy it to `context/expansion-plays.md` and rewrite it for what you sell.
5. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about; _What you can change_ is what you offer unprompted; _What you will be asked_ is the floor,
   and you derive before you ask. Record what you changed and why under `## Decisions` in your copy
   of this file.
6. **Check, then plan.** `node --import tsx evals/contract.mjs` from this skill's folder, then
   `npm run check && cargo-ai cdk plan` from the project root. Show the diff, and deploy only on an
   explicit yes. The play ships disabled.
7. **Pilot.** Run the play by hand on five companies from the window, read each written reason
   against its sources, then enable the play and let the digest post the next Monday.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked.

| Input                                     | Kind    | How it is answered                                                                                                                                                                  | Why it matters                                                                                                                                         |
| ----------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HubSpot connector                          | value   | **derived**: `cargo-ai connection connector list`. `default: true` binds it.                                                                                                         | It is both the source and the only write path.                                                                                                         |
| what marks a customer                      | derived | Count companies by `lifecyclestage` in `crm_companies` after the first sync. Most portals use `customer`; some mark it with a custom property or a closed-won deal only.             | A filter on a value nobody sets selects nothing, and an empty Monday reads as a quiet week.                                                             |
| the renewal window                         | asked   | the contract length most customers sign. Annual is the default: last deal closed ten to twelve months ago.                                                                          | A monthly book judged on an annual window is judged once a year; a two-year book is judged a year early.                                                |
| the three HubSpot properties               | derived | `listObjectProperties` on companies shows whether they exist; create them if not.                                                                                                    | A write to a missing property fails every row.                                                                                                         |
| the expansion plays                        | asked   | what you sell into an existing customer and which play answers which signal. Written once into the context.                                                                        | Without it, `suggested_play` is generic advice. With it, the digest tells the account manager what to do.                                               |
| `channelId` on the digest                  | asked   | the Slack channel id (`C…`) from the connector's channel autocomplete. Invite the bot.                                                                                               | The digest names customers and their renewal risk. Locked so it never lands in a customer shared channel.                                               |

## What you can change

| Variation         | When it is right                                                    | How                                                                                                         | What it costs                                                                                                           |
| ----------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `window`          | Contracts are not annual                                            | Change the two `recent_deal_close_date` values in `infra/plays/flag-expansion.ts`, and the sixty-day rule with them | A window longer than the re-judge rule judges an account twice per renewal.                                              |
| `renewal-date`    | The CRM holds a real renewal date property                          | Filter on that property instead of `recent_deal_close_date`                                                 | Accounts without the property drop out silently. Count them first.                                                     |
| `whole-book`      | You want every customer judged, not only those near renewal         | Drop the two `recent_deal_close_date` conditions                                                             | Every customer is judged every sixty days. That is the whole book's worth of agent runs and searches each cycle.         |
| `no-web`          | Compliance does not allow web research on customers                 | Drop `webSearch` from the analyst and its search sentence                                                    | Only `renewal`, `repeat_purchase` and `none` remain reachable from the CRM alone.                                        |
| `per-owner-dm`    | Account managers want their own list                                | Replace the locked `channelId` with one `postMessage` use per owner channel, and split the post by owner      | More locked uses to keep in sync with the team. An owner with no use gets nothing.                                      |

## What should not change

- **The models pull everything.** (`infra/models/`) Who is a customer and who is in the window is
  the play's filter. A filter in the extractor is a second place that question is asked, invisible
  from the play, and changing it means a re-extraction.
- **The play writes the company record id, and only Cargo's three properties.**
  (`infra/plays/flag-expansion.ts`) A unify step between the play and the write reports success
  while nothing lands. A write to a deal or owner turns a judgment into a forecast change nobody
  approved. The contract fails on either.
- **The analyst reads, never writes.** (`infra/agents/analyst.ts`) An agent that can write decides
  its own routing, and a missing signal could then be a failed run, a skip or a choice.
- **The sixty-day rule stays at least as long as the window.** Without it the same renewal is
  judged and re-written every Monday, and each judgment overwrites the last reason.
- **The digest re-judges nothing.** (`infra/agents/digest.ts`) It reads the reason the record
  carries. A second judgment in Slack is how the CRM and the channel disagree about the same
  account.
- **The ledger, not Slack history, is the digest's dedupe.** A deleted post or another bot's
  message would otherwise read as "already sent" and drop a week in silence.

## Done when

- `node --import tsx evals/contract.mjs` passes
- `cargo-ai cdk plan` reports the two HubSpot models, the ledger, the two agents, the play, three
  connectors and three folders, with the play disabled
- the first sync of `crm_companies` carries `lifecyclestage`, `recent_deal_close_date` and the three
  `cargo_expansion_*` columns
- a hand run on five companies in the window wrote a signal, a reason and a stamp onto each HubSpot
  company, and every event named in a reason has a dated source in it
- a second hand run the same week judged none of them again
- the digest posted once in the locked channel, listed exactly the companies stamped that week with
  a signal other than `none`, and a re-run that week posted nothing
- no deal, contact or owner changed in HubSpot

## What it costs

The CRM sync and write are HubSpot API calls. The research is web search inside the analyst, at most
three per company. Immediately before the plan, read the live price of each action:

- `cargo-ai orchestration action list updateRecords --kind connector --integration-slug hubspot`
- `cargo-ai orchestration action list postMessage --kind connector --integration-slug slack`

Say each number out loud. The recurring cost is one analyst run per company in the window each
week, plus one digest run, billed as LLM tokens through the Anthropic connector. It scales with how
many customers are near renewal, not with the size of the book, and the sixty-day rule keeps any
one company to one judgment per window. Count the window before enabling:
`SELECT count(*)` over `crm_companies` with the play's filter.

## Composes into

`crm-enrichment` (firmographics on the same company records), `win-loss-review` (what closed-won
says about who expands), and `track-job-changes` (a champion who left is the first at-risk signal).
