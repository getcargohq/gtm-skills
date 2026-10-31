---
name: rep-cockpit
description: 'Deploy the app your reps work from: hot leads (ready now or warming, best fit first, with the signals behind them) to claim or pass, a claim that sources the account''s buying committee, finds work emails and drafts a first touch per person, a send from the rep''s own Cargo mailbox or LinkedIn, and the replies and follow-ups that come after. Triggers: "build a rep cockpit", "a daily surface for my reps to claim accounts", "let reps claim hot accounts and send from Cargo", "one screen per rep with their accounts and drafts", "claim, source, draft, send". Cargo project, defineApp, app-sdk, defineMailbox, defineMember, sendEmail, AI Ark, Prospeo. Skip when: a readiness score with no app, which is readiness-scoring; tiering accounts, which is account-scoring; an agent that answers replies, which is agentic-engagement; one account''s stakeholders once, which is find-stakeholders.'
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
accounts that are ready now or warming, best fit first, with each company's logo and LinkedIn
page and the dated signals behind it, that nobody holds; a rep filters it by tier, readiness,
signals or name. A rep clicks **Claim**, or **Pass** with a reason (a "not now" comes back in 90
days), or adds an account the queue never surfaced by its website. A claim is one tool run on the
server: the account lands on GTM accounts, the buying committee is searched at its domain, each
person lands on GTM contacts with a work email when one is found, and the writer agent drafts a
first touch for each, from the account's tier, readiness and signals and the company's own
positioning in context.

**My accounts** holds what the rep claimed, with the replies and follow-ups waiting on each. An
account page shows each person with the draft, editable, with **Regenerate** (the rep says what to
change), **Find email and phone**, and **Send**, from the rep's own Cargo mailbox. Under each
email sits the writer's LinkedIn connection note, with **Send invite** and **Send message** from
the rep's own LinkedIn identity. Next to it, the account's **Timeline** from GTM activities. The send writes an `email` row on GTM activities, so
meeting-prep, next-step-tracker and the readiness score see the touch.

Then one play waits on each sent thread. A **reply** lands on the person's card with its first
lines and on the timeline, with a **Meeting booked** button that logs the meeting. **No reply**
after four days, and the writer drafts a short follow-up in the same thread, for the rep to read
and send like the first.

It is the surface on top of the scores, not a score. account-scoring decides who is worth working,
readiness-scoring decides when; the cockpit is where a rep acts on both, and where "who is on it"
is settled for the whole team.

**The rep sends, never the cockpit.** Nothing goes out on a schedule or in bulk, the follow-ups
included. Every email is one click by the rep it is from, after they read it, from the mailbox
attached to them. Cargo checks
the workspace suppression list before each send, paces each mailbox, and adds the unsubscribe link.

**Four failure modes worth knowing before you start.** A native write takes a minute or two to
reach SQL, so the app holds a rep's own clicks in the browser for fifteen minutes; a teammate
sees the claim when SQL does. A rep matched to no member, or a member with no mailbox, can claim
and read drafts but cannot send, and the page says why. A new mailbox starts at the bottom of its
warm-up ramp: a rep's first week sends a handful a day, whatever the cockpit drafts. And the play
waits for a reply only until the next touch is due: a reply that lands after the last touch's wait
is in the rep's mailbox, not on the card.

## Example

> Build a cockpit where my SDRs claim hot accounts, get the buying committee with drafts, and send from their own mailbox.

Illustrative output, fictional records:

```
Hot leads                      Fit     Why now
Northwind Traders              Tier A  Ready now · funding 2026-10-14 · job post 2026-10-20
Fabrikam                       Tier B  Warming · product launch 2026-10-09         [Pass] [Claim]

Northwind Traders · claimed by Jane · 3 sourced
  Priya Raman, VP Revenue Operations · priya@northwind.example · LinkedIn
    first-touch writer
      why now: Series B two weeks ago and a RevOps manager role open
      subject: routing after the round
      body:    A new RevOps hire usually means routing gets rebuilt next.
               Who owns that today?
      note:    Saw the RevOps opening at Northwind, routing is a topic I follow.
    [Send] → sent from jane@example-outreach.com → replied two days later  [Meeting booked]
    [Send invite] → LinkedIn invite with the note, from Jane's LinkedIn
  Leo Martins, Head of Sales · no reply in four days · follow-up drafted in the thread  [Send]
  Omar Haddad, CMO · no work email · [Find email and phone] → found · draft ready  [Send]

Timeline  email to Priya · LinkedIn invite to Priya · reply from Priya · meeting with Priya
```

Three people sourced and drafted on one claim: Priya replied and a meeting is logged, Leo's
follow-up waits in his thread for Jane's click, and Omar's email turned up on a second lookup.

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
   on its own, and one play, `rep_cockpit_watch_replies`, enabled on deploy. When the project
   already declares any of them, rewire the imports to the existing one and delete the copy: one
   slug declared twice collides at deploy. A mailbox or domain the
   project already declares (agentic-engagement) is reused the same way. This skill declares no
   `defineContext`.
3. **Point the queue at your scores.** The Hot leads and signals queries are in
   `infra/apps/cockpit/src/lib/queries.ts`, the one place the app reads them. Run
   `cargo-ai storage dataset list` and `cargo-ai storage column list` on Unify Accounts, Account
   Events and the tiered companies model, and fix the table and column names in the queries (see [`references/run.md`](references/run.md#queue)). Run
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
   client, reply to it and watch the reply land on the card, then hand the URL to the reps. Walk _Done when_ line by line with evidence.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked.

| Input                | Kind    | How it is answered                                                                                                            | Why it matters                                                                                       |
| -------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| reps                 | asked   | Who sends from the cockpit, by Cargo login email, checked against `cargo-ai revenue-organization member list`                 | Each one is a member the cockpit matches, and a mailbox billed every month                           |
| sending domain       | derived | `cargo-ai mailboxManagement mailbox list` and the workspace's domains; an active one that is not the primary domain           | A mailbox can only live on an active domain, and cold mail from the primary domain risks it          |
| buying committee     | derived | Proposed from the ICP and personas in context as AI Ark seniorities and departments, confirmed by the operator                | It is who every claim pays to find and draft for                                                     |
| queue tables         | derived | `cargo-ai storage dataset list` and `column list` on Unify Accounts and the tiered model                                      | A wrong table name is an empty Hot leads page, not an error the deploy catches                       |
| contacts per claim   | derived | 3 by default; raised only on the operator's word                                                                              | It multiplies every per-claim cost                                                                   |
| LinkedIn identities  | derived | Each rep's member under the LinkedIn connector (`cargo-ai revenue-organization member list`); a rep with none connects LinkedIn with the Cargo Chrome extension | Without one the rep's LinkedIn buttons are off, with the reason on the card                          |
| follow-up timing     | derived | `followUpAfterHours` 96 and `touchesPerContact` 2 in `infra/settings.ts`; changed only on the operator's word                | A shorter wait reads as nagging; each extra touch is one more email from a rep to a silent person    |
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
| `tier-only-queue`  | readiness-scoring is not installed                                         | Drop the readiness join and filter in `queries.ts` and the signals query; rank tier A then B by `tiered_at`                                              | No "why now": the queue is every good fit, and reps pick by fit alone                                                       |
| `crm-backed`       | Reps live in HubSpot, Salesforce or Attio                                  | Swap `gtm_accounts`/`gtm_contacts` for the CRM's companies and contacts (`fetchRecords`, every column), upsert there in the claim tool, and log the send as a CRM email engagement in the send tool | One CRM write per sourced person and per send, and a CRM grant to deploy                                                    |
| `waterfall-email`  | Prospeo misses too many in your market                                     | A second email provider in the claim tool, called only when the first returned nothing                                                                   | The second provider's price on every miss                                                                                    |
| `email-only`       | Reps do not work LinkedIn                                                  | Drop `send-linkedin.ts`, the LinkedIn connector and `linkedin_note` from the writer's output; the panel hides with no tool id                          | One channel fewer per person                                                                                                |
| `stored-logo`      | The browser may not call a favicon service                                 | `enrichCompanyFromDomain` on LinkedIn in the claim tool, the logo stored on `cockpit_claims`, read instead of the favicon                               | A company lookup per claim, and Hot leads rows (unclaimed) show initials                                                    |
| `phone-on-claim`   | Reps call before they email                                                | `findPhone` in the claim tool's loop instead of on the Find email and phone click                                                                       | A phone lookup on every sourced person, several times an email's price, called or not                                       |
| `tam-map`          | Leadership wants the whole market on the same screen                       | A third page over `tam_companies` with counts by tier and readiness, and Claim from any row                                                               | A heavier query on every load; keep it one aggregated SQL, never the rows                                                    |
| `book-of-business` | Reps also manage open deals here                                           | A page over `gtm_opportunities` where `owner_id` is the rep                                                                                               | Owner ids must map to reps, which is a second identity table to keep                                                        |
| `reply-only`       | The team writes its own follow-ups                                         | `touchesPerContact = 1`: the play still logs replies, and marks a silent thread no_reply instead of drafting                                            | Silent threads wait on the rep's memory                                                                                     |

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
- **LinkedIn goes out as the rep, on a click.** (`infra/tools/send-linkedin.ts`) The identity comes
  from the rep's member like the mailbox. A shared LinkedIn seat sends as the wrong person, and an
  invite sent by a play is the automation LinkedIn restricts accounts for.
- **The watch play never sends.** (`infra/plays/watch-replies.ts`) It waits, logs and drafts; the
  follow-up goes out on the rep's click. A play that sent the follow-up would be a sequence running
  on four-day-old judgement about a person.
- **A follow-up replies in its thread.** (`in_reply_to` in `infra/tools/send-draft.ts`) Sent as a
  new email, it reads as a second cold email, and the play's next wait keys off a thread with no
  history.
- **The send and its log are one run.** (`infra/tools/send-draft.ts`) Logged from the browser after
  the send, a closed tab loses the activity row, and every pipeline reading GTM activities misses a
  touch that happened.
- **The mailbox comes from the rep's member, not from the app.** (`src/lib/rep.ts`) A rep table in
  the app source is a redeploy per hire, and a missing row reads as a dead Send button.
- **Claims are keyed by domain, one row per account.** (`cockpit_claims`) Two keys and the queue and
  the account page disagree about who owns an account.
- **The writer has no write access and no web search.** (`infra/agents/first-touch-writer.ts`) It
  gets what the claim, the redraft or the play knows and returns JSON; the caller persists it. With search, every draft pays
  for research the queue already did, and with write access a missing draft could be a choice.
- **Reads are SQL, and a rep's own clicks are held in the browser.** (`src/lib/held.tsx`) Waiting
  on the write before moving the UI is how a claim gets clicked twice and sourced twice.

## Done when

- the plan showed the five models, the four tools, the writer agent, the watch play, the mailboxes
  on the adopted domain, the members with their mailboxes and the app, and the operator approved
  the deploy and each mailbox's price
- the app URL (`cockpit.url`, or `cargo-ai hosting app list`) loads behind the Cargo login and Hot
  leads lists accounts that match the query run by hand, with their signals
- a "Not now" pass left Hot leads with `pass_reason` and `parked_until` on its claim row
- one claim landed the account on `gtm_accounts`, the committee on `gtm_contacts`, a draft per
  person on `cockpit_drafts`, and `sourcing_status` ready on its claim, within a few minutes
- the claimed account left Hot leads for every rep once SQL caught up, and showed under My accounts
- one send to an address the operator owns arrived from the rep's mailbox with the unsubscribe
  link, the draft read `sent`, and one `email` row landed on `gtm_activities`
- one LinkedIn invite with the writer's note went out from the rep's own LinkedIn and logged a
  `note` on GTM activities
- Regenerate with an instruction changed one draft's text, and Find email and phone wrote what it
  found onto the card
- the watch play started a run on that send; a reply from the address you own landed on the card
  and the timeline as a reply (or, with no reply, the follow-up was drafted after
  `followUpAfterHours`), and Meeting booked wrote a `meeting` row
- a rep with no mailbox saw why Send was off
- `node --import tsx evals/contract.mjs` passes against the adapted resources

## What it costs

**A claim** bills one people search per person returned, one email lookup per person, and one
writer run per person (an LLM call that reads a few context files). Read the current prices with
`cargo-ai connection integration get aiArk` and `cargo-ai connection integration get prospeo`, and
the writer's cost from the pilot claim's run (`cargo-ai orchestration run get`), and give the
operator a per-claim estimate at `contactsPerClaim`.

**A send** is the native `sendEmail` price per message, and its **watch** is one wait on the
thread plus, when nobody replies, one writer run for the follow-up. **Regenerate** is one writer
run per click. **Find email and phone** is one email lookup and one phone lookup per click; the
phone is several times the email's price (`cargo-ai connection integration get prospeo`).
**A LinkedIn invite or message** is one `linkedin` action per click
(`cargo-ai connection integration get linkedin`). Logos are the domain's favicon, loaded by the
browser, and bill nothing. **Each mailbox** is a recurring monthly
charge for as long as it exists (`cargo-ai mailboxManagement pricing get`), and the app is a hosted
app on the workspace's hosting plan. Hot leads, My accounts, the account page and the timeline are
SQL reads and bill nothing.

## Composes into

`account-scoring` and `readiness-scoring` feed the queue (fit and timing); `tam-building` feeds
the companies they score. Every send lands on `gtm_activities`, which `meeting-prep`,
`next-step-tracker` and readiness-scoring's first-party events read. `agentic-engagement` can take
the thread over once a prospect replies.
