---
name: rep-cockpit
description: 'Deploy the app your reps work from: hot leads (ready now or warming, best fit first) to claim or pass, a claim that sources the account''s buying committee, finds work emails and drafts a first touch per person, and a send from the rep''s own Cargo mailbox that logs the touch. Triggers: "build a rep cockpit", "a daily surface for my reps to claim accounts", "let reps claim hot accounts and send from Cargo", "one screen per rep with their accounts and drafts", "claim, source, draft, send". Cargo project, defineApp, app-sdk, defineMailbox, defineMember, sendEmail, AI Ark, Prospeo. Skip when: a readiness score with no app, which is readiness-scoring; tiering accounts, which is account-scoring; an agent that answers replies, which is agentic-engagement; one account''s stakeholders once, which is find-stakeholders.'
version: "0.1.0"
compatibility: "Requires the cargo-project skill, a Cargo project (cargo.json at its root), @cargo-ai/cdk 1.0.133 or later (defineApp env tokens, defineMember mailboxes), an active sending domain in the workspace, an authorized Anthropic connector, AI Ark and Prospeo connectors, and reps who are members of the workspace. The queue reads readiness-scoring's columns on Unify Accounts and account-scoring's tier. The repository example does not deploy or bill anything until an agent adapts it in the consumer project."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/rep-cockpit
metadata:
  author: getcargo
  source: cookbook
  personas:
    - sales-development
    - account-executive
    - revops
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

# Rep cockpit

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai project plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

One screen your reps open in the morning, at a URL behind the Cargo login. **Hot leads** lists the
accounts that are ready now or warming, best fit first, that nobody has claimed or passed. A rep
clicks **Claim**, and one tool run does the rest on the server: the account lands on GTM accounts,
the buying committee is searched at its domain, each person lands on GTM contacts with a work email
when one is found, and the writer agent drafts a first touch for each, from the account's tier
reason and readiness and the company's own positioning in context. **My accounts** holds what the
rep claimed; an account page shows each person with the draft, editable, and a **Send** button
that sends from the rep's own Cargo mailbox. The send marks the draft sent and writes an `email`
row on GTM activities, so meeting-prep, next-step-tracker and the readiness score see the touch.

It is the surface on top of the scores, not a score. account-scoring decides who is worth working,
readiness-scoring decides when; the cockpit is where a rep acts on both, and where "who is on it"
is settled for the whole team.

**The rep sends, never the cockpit.** Nothing goes out on a schedule or in bulk. Every email is one
click by the rep it is from, after they read it, from the mailbox attached to them. Cargo checks
the workspace suppression list before each send, paces each mailbox, and adds the unsubscribe link.

**Three failure modes worth knowing before you start.** A native write takes a minute or two to
reach SQL, so the app holds a rep's own clicks in the browser for fifteen minutes; a teammate
sees the claim when SQL does. A rep matched to no member, or a member with no mailbox, can claim
and read drafts but cannot send, and the page says why. And a new mailbox starts at the bottom of
its warm-up ramp: a rep's first week sends a handful a day, whatever the cockpit drafts.

## Example

> Build a cockpit where my SDRs claim hot accounts, get the buying committee with drafts, and send from their own mailbox.

Illustrative output, fictional records:

```
Hot leads                                   Fit      Readiness
Northwind Traders   northwind.example       Tier A   Ready now    [Pass] [Claim]
Fabrikam            fabrikam.example        Tier B   Warming      [Pass] [Claim]

Northwind Traders · claimed by Jane · 3 sourced · drafts ready
  Priya Raman, VP Revenue Operations · priya@northwind.example
    first-touch writer
      why now: Series B two weeks ago and a RevOps manager role open
      subject: routing after the round
      body:    Hi Priya, congrats on the round. A new RevOps hire usually means
               routing gets rebuilt next. Who owns that today?
    [Send]  → sent from jane@example-outreach.com · logged on GTM activities
  Leo Martins, Head of Sales · leo@northwind.example · draft ready    [Send]
  Omar Haddad, CMO · no work email found · draft kept, Send off
```

Three people sourced and three drafts from the first-touch writer: one sent after the rep edited a
line, one waiting for review, one with no work email for the rep to reach another way.

## Put it in your project

This folder is a **worked example**: real project resources written for some other company. The job
is to end up with the code your company would have written, in your project, and an agent does the
adapting.

**Install the required authoring skill first.** If `cargo-project` is absent, run:

```sh
npx skills add getcargohq/cargo-skills --skill cargo-project
```

Then read `.agents/skills/cargo-project/SKILL.md` directly; no session reload is needed. Complete its
bootstrap and use its authoring, state, plan, and deployment rules throughout. Stop before any
template work if the skill cannot be installed or read.

1. **Install it: the CLI does the copy.** From inside the project (the folder holding `cargo.json`),
   `cargo-ai project add cookbook/rep-cockpit` writes this example to `infra/rep-cockpit/` and this
   procedure to `.claude/skills/rep-cockpit/`. No project yet?
   `cargo-ai project init <dir> --cookbook rep-cockpit && cd <dir> && npm install` does both. **If
   you are reading this from the project's `.claude/skills/`, the install already happened: start
   at step 2.**
2. **Reconcile it with what is already declared.** This example carries the shared `gtm_accounts`,
   `gtm_contacts` and `gtm_activities`, and AI Ark, Prospeo and Anthropic connectors, so it deploys
   on its own. When the project already declares any of them, rewire the imports to the existing
   one and delete the copy: one slug declared twice collides at deploy. A mailbox or domain the
   project already declares (agentic-engagement) is reused the same way. This skill declares no
   `defineContext`.
3. **Point the queue at your scores.** The Hot leads query is `infra/apps/cockpit/src/lib/queries.ts`,
   the one place the app reads them. Run `cargo-ai storage dataset list` and
   `cargo-ai storage column list` on Unify Accounts and on the tiered companies model, and fix the
   table and column names in the query (see [`references/run.md`](references/run.md#queue)). Run
   the query once with `cargo-ai storage query execute` and read the rows before going on.
4. **Set up the senders.** One `defineMailbox` per rep who sends, on the sending domain, attached to
   that rep's member in `infra/members/reps.ts` by their Cargo login email. Quote the live monthly
   price from `cargo-ai mailboxManagement pricing get` and get an explicit yes per mailbox.
5. **Adapt and deploy.** Work the sections below in order: _What should not change_ is what you
   argue back about (say what breaks, then do it if they still want it); _What you can change_ is
   what you offer unprompted; _What you will be asked_ is the floor, and you derive before you ask.
   Record what you changed and why under a `## Decisions` section in your copy of this file. Then
   run `node --import tsx evals/contract.mjs` from this skill's folder, `npm install && npm run
type:check` in `infra/apps/cockpit/`, then `cargo-ai project types && cargo-ai project check &&
cargo-ai project plan` from the project root. Show the diff, and deploy only on a yes. Never run
   `cargo-ai project init --force` in a non-empty directory.
6. **Pilot with one claim and one send to yourself.** Follow [`references/run.md`](references/run.md):
   claim one account, read the drafts, send one to an address you own, read it in a real mail
   client, then hand the URL to the reps. Walk _Done when_ line by line with evidence.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked.

| Input                | Kind    | How it is answered                                                                                                            | Why it matters                                                                                       |
| -------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| reps                 | asked   | Who sends from the cockpit, by Cargo login email, checked against `cargo-ai revenue-organization member list`                 | Each one is a member the cockpit matches, and a mailbox billed every month                           |
| sending domain       | derived | `cargo-ai mailboxManagement mailbox list` and the workspace's domains; an active one that is not the primary domain           | A mailbox can only live on an active domain, and cold mail from the primary domain risks it          |
| buying committee     | derived | Proposed from the ICP and personas in context as AI Ark seniorities and departments, confirmed by the operator                | It is who every claim pays to find and draft for                                                     |
| queue tables         | derived | `cargo-ai storage dataset list` and `column list` on Unify Accounts and the tiered model                                      | A wrong table name is an empty Hot leads page, not an error the deploy catches                       |
| contacts per claim   | derived | 3 by default; raised only on the operator's word                                                                              | It multiplies every per-claim cost                                                                   |
| positioning in context | derived | The ICP, persona and positioning files in the context repository (`cargo-ai context graph`); flagged when missing         | The writer reads them for every draft; without them every draft pitches something generic            |

Checked before moving on, not after the deploy:

- the Hot leads query returns rows when run by hand, with `domain`, `name`, `tier` and
  `readiness_stage` filled on most of them
- every rep in `infra/members/reps.ts` is a member, by the exact email they sign in with
- the sending domain is active, and the operator said yes to each mailbox's monthly price

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the
default.

| Variation          | When it is right                                                          | How                                                                                                                                                       | What it costs                                                                                                               |
| ------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `tier-only-queue`  | readiness-scoring is not installed                                         | Drop the readiness join and filter in `queries.ts`; rank tier A then B by `tiered_at`                                                                    | No "why now": the queue is every good fit, and reps pick by fit alone                                                       |
| `crm-backed`       | Reps live in HubSpot, Salesforce or Attio                                  | Swap `gtm_accounts`/`gtm_contacts` for the CRM's companies and contacts (`fetchRecords`, every column), upsert there in the claim tool, and log the send as a CRM email engagement in the send tool | One CRM write per sourced person and per send, and a CRM grant to deploy                                                    |
| `waterfall-email`  | Prospeo misses too many in your market                                     | A second email provider in the claim tool, called only when the first returned nothing                                                                   | The second provider's price on every miss                                                                                    |
| `more-channels`    | Reps also work LinkedIn or the phone                                       | More fields on the writer's output (a connection note, a call opener) and on `cockpit_drafts`; a phone lookup in the claim tool                           | A longer draft per person, and a phone lookup is several times an email's price                                             |
| `tam-map`          | Leadership wants the whole market on the same screen                       | A third page over `tam_companies` with counts by tier and readiness, and Claim from any row                                                               | A heavier query on every load; keep it one aggregated SQL, never the rows                                                    |
| `book-of-business` | Reps also manage open deals here                                           | A page over `gtm_opportunities` where `owner_id` is the rep                                                                                               | Owner ids must map to reps, which is a second identity table to keep                                                        |
| `follow-ups`       | A rep wants the next touch drafted too                                     | A play on `cockpit_drafts` sent more than N days ago with no reply event, re-running the writer with the thread                                           | One more draft per silent thread; the rep still sends it                                                                    |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **Every send is one click by the rep it is from.** (`infra/tools/send-draft.ts`, called from the
  account page only) A scheduled or bulk send from this cockpit is a sequencer with no review step,
  and the first bad draft goes to everyone.
- **The claim runs on the server, in one tool run.** (`infra/tools/claim-account.ts`) Orchestrated
  from the browser, closing the tab mid-claim leaves an account claimed with nothing sourced, and
  nobody notices because the claim row looks fine.
- **Inside the per-person loop, values come from the claim row, never `input`.**
  (`infra/tools/claim-account.ts`) Each iteration of a `for…of` runs as a child run whose input is
  the person, so `input.account_domain` there is empty: the email lookup fails on every person and
  the writer drafts with no account context, while the claim still ends `ready`.
- **The send and its log are one run.** (`infra/tools/send-draft.ts`) Logged from the browser after
  the send, a closed tab loses the activity row, and every pipeline reading GTM activities misses a
  touch that happened.
- **The mailbox comes from the rep's member, not from the app.** (`src/lib/rep.ts`) A rep table in
  the app source is a redeploy per hire, and a missing row reads as a dead Send button.
- **Claims are keyed by domain, one row per account.** (`cockpit_claims`) Two keys and the queue and
  the account page disagree about who owns an account.
- **The writer has no write access and no web search.** (`infra/agents/first-touch-writer.ts`) It
  gets what the claim knows and returns JSON; the tool persists it. With search, every draft pays
  for research the queue already did, and with write access a missing draft could be a choice.
- **Reads are SQL, and a rep's own clicks are held in the browser.** (`src/lib/held.tsx`) Waiting
  on the write before moving the UI is how a claim gets clicked twice and sourced twice.

## Done when

- the plan showed the five models, the two tools, the writer agent, the mailboxes on the adopted
  domain, the members with their mailboxes and the app, and the operator approved the deploy and
  each mailbox's price
- the app URL (`cockpit.url`, or `cargo-ai hosting app list`) loads behind the Cargo login and Hot
  leads lists accounts that match the query run by hand
- one claim landed the account on `gtm_accounts`, the committee on `gtm_contacts`, a draft per
  person on `cockpit_drafts`, and `sourcing_status` ready on its claim, within a few minutes
- the claimed account left Hot leads for every rep once SQL caught up, and showed under My accounts
- one send to an address the operator owns arrived from the rep's mailbox with the unsubscribe
  link, the draft read `sent`, and one `email` row landed on `gtm_activities`
- a rep with no mailbox saw why Send was off
- `node --import tsx evals/contract.mjs` passes against the adapted resources

## What it costs

**A claim** bills one people search per person returned, one email lookup per person, and one
writer run per person (an LLM call that reads a few context files). Read the current prices with
`cargo-ai connection integration get aiArk` and `cargo-ai connection integration get prospeo`, and
the writer's cost from the pilot claim's run (`cargo-ai orchestration run get`), and give the
operator a per-claim estimate at `contactsPerClaim`.

**A send** is the native `sendEmail` price per message. **Each mailbox** is a recurring monthly
charge for as long as it exists (`cargo-ai mailboxManagement pricing get`), and the app is a hosted
app on the workspace's hosting plan. Hot leads, My accounts and the account page are SQL reads and
bill nothing.

## Composes into

`account-scoring` and `readiness-scoring` feed the queue (fit and timing); `tam-building` feeds
the companies they score. Every send lands on `gtm_activities`, which `meeting-prep`,
`next-step-tracker` and readiness-scoring's first-party events read. `agentic-engagement` can take
the thread over once a prospect replies.
