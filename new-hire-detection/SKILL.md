---
name: new-hire-detection
description: 'Watch your whole market for people who just took a role you sell to, and route each one into the CRM by what it already holds: qualify and create a new account, alert the owner of an open deal, have the CSM welcome them at a customer, or add them to a known account. A deployed pipeline on a Sales Navigator job-change search, ending at the CRM write. Triggers: "watch our market for new hires and put them in HubSpot", "a decision-maker just joined a company in our market", "new KDM detection", "route new hires into the CRM", "tell the deal owner when a new decision-maker lands mid-deal", "new VPs of Sales at companies in our ICP", "run our new-hire play on a schedule". Cargo CDK, Sales Navigator, HubSpot, Salesforce, Attio. Skip when: your own CRM contacts may have moved jobs, which is track-job-changes; or you want a list of people once, which is find-b2b-leads.'
version: "0.1.0"
compatibility: "Requires the cargo-cdk skill, a Cargo CDK project, @cargo-ai/cdk 1.0.88 or later, and authenticated Sales Navigator, LinkedIn, LLM and CRM connectors (HubSpot in the example; Salesforce and Attio by adaptation). No LinkedIn seat, user or cookie is needed. The repository example does not deploy, extract or write anything until an agent adapts it in the consumer project."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/new-hire-detection
metadata:
  author: getcargo
  source: cookbook
  personas:
    - revops
    - sales-development
    - gtm-engineering
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

# New-hire detection

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

Every person who just took a role you sell to, anywhere in your market, lands in the CRM on the
right account, and the person who has to act on it gets a task. Not a list of names: a pipeline that keeps watching
and keeps routing.

A person entering a new role is the cleanest buying signal in B2B: fresh budget, a mandate to
change things, and no loyalty yet to the vendor already in place. But the same event means
different things depending on what the CRM already holds, and the routes are the play:

| The account is…          | What the event means                                     | What the play does                                                                                   |
| ------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Not in the CRM           | A new account with a timing signal                       | Qualifies it against your ICP first. If it fits: creates the account, the contact, and a task        |
| In the CRM, open deal    | A new decision-maker landed mid-deal                     | Adds the contact and a high-priority task for the owner. The route most CRMs miss entirely           |
| A customer               | A new stakeholder who did not choose you                 | Adds the contact and a task for the CSM to welcome them before they form a view                      |
| Any other stage, lead included | The account already has whatever motion owns it    | Adds the contact to the account. No task, no allocation                                              |

**One contact per person.** Before anything is written, the person is looked up across the whole
CRM by their LinkedIn identity. Already a contact on the account they just joined: not news, the
run stops. A contact somewhere else: they moved, and that record is moved to the new account
rather than duplicated, with the move noted in the task. Whether the team wants that, or a new
contact per company, is asked at install.

The market is the scope, not your book. The source is a Sales Navigator people search over the
industry, headcount band, location and titles you choose, filtered to people who changed jobs in
the last year and took this position in the last year. Watching people you already hold is
`track-job-changes`.

The play ends at the CRM write. It drafts and sends nothing; the task is the hand-off.

**Two failure modes worth knowing before you start.** A search URL encoded once instead of twice
loads an empty search, and the sync reports success with nothing in it. And if the CRM stores
domains in a form the lookup does not search, every known account looks new, the qualifier creates
duplicates, and the open-deal route never fires. The play searches the bare domain, `www.` and
`https://` forms (`infra/scripts/lookup.ts`); a CRM that stores anything else needs it added there.

## Example

> Every time a new VP Sales or head of RevOps starts at a US software company with 51 to 500 people, put them in HubSpot and tell the right owner.

Illustrative output, fictional records:

| Person (role)                        | Company (domain)              | Route            | What landed in HubSpot                                                                          |
| ------------------------------------ | ----------------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| Priya Raman (VP Sales)               | Northwind (northwind.example) | open_opportunity | Contact created; HIGH task "New decision-maker mid-deal" on the account owner, on the account   |
| Tomás Ortega (Head of RevOps)        | Fabrikam (fabrikam.example)   | customer         | Existing contact moved from his previous company; HIGH welcome task on the account's CSM        |
| Mei Lin (Chief Revenue Officer)      | Contoso (contoso.example)     | new_account      | Qualified Tier 1 (84/100); account, contact and task created for the named owner                |
| Sam Hale (VP Sales)                  | Tailspin (tailspin.example)   | new_account      | Not ICP: a consumer app, a disqualifier in the ICP. Nothing written                              |
| Ana Costa (Director of RevOps)       | Litware (litware.example)     | known_account    | Lead-stage account: contact added to it, no task                                                 |
| Ben Ito (Head of Sales)              | Adatum (adatum.example)       | known_account    | Already a contact on this account. Nothing written, no email paid for                            |

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job
is to end up with the code your company would have written, in your project, and an agent does the
adapting.

**Install the required authoring skill first.** If `cargo-cdk` is absent, run:

```sh
npx skills add getcargohq/cargo-skills --skill cargo-cdk
```

Then read `.agents/skills/cargo-cdk/SKILL.md` directly; no session reload is needed. Complete its
bootstrap and use its authoring, state, plan, and deployment rules throughout. Stop before any
search or template work if the skill cannot be installed or read.

1. **Install it — the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/new-hire-detection` writes this example to
   `infra/new-hire-detection/` and this procedure to `.claude/skills/new-hire-detection/`. No
   project yet? `cargo-ai cdk init <dir> --cookbook new-hire-detection && cd <dir> && npm install`
   does both; this folder never ships a shell. **If you are reading this from the project's
   `.claude/skills/`, the install already happened — start at step 2.** On a CLI too old to have
   `add`, copy this folder in as a sibling of what is there by hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** For every resource this example carries that the
   project already has (a Sales Navigator, LinkedIn, LLM or CRM connector, a new-hire folder),
   rewire the imports to the existing one and drop the copy. Two resources with one slug is a
   collision at deploy. This skill declares no `defineContext`: that resource is a per-workspace
   singleton owned by the project. Copy `infra/context/icp.md` into the project's `context/` only
   when no ICP is written there yet. This folder needs nothing in `.env`; append nothing and never
   overwrite it.
3. **Pick the CRM, then adapt to it.** Inspect the authenticated connectors. HubSpot is the checked
   example. For Salesforce or Attio, follow
   [`references/crm-adaptation.md`](references/crm-adaptation.md) and change all five things it
   lists together. On Salesforce every lookup is `findRecords` or `searchRecords`, never
   `soqlQuery`.
4. **Shape and count the search.** Follow [`references/search.md`](references/search.md): derive
   the titles, industries, headcount and locations from the ICP (ask only when there is none),
   resolve every facet id through the autocompletes, and count each URL with
   `searchPersonMetrics`. Above 2,500, split by a facet. Stop for approval of the search, the
   limit, the cadence and the estimated cost per sync. Nothing is extracted while it is pending.
5. **Adapt and deploy for the pilot.** Work the sections below in order: _What should not change_
   is what you argue back about (say what breaks, then do it if they still want it); _What you can
   change_ is what you offer unprompted; _What you will be asked_ is the floor, and you derive
   before you ask. Record what you changed and why under a `## Decisions` section in your copy of
   this file. Set `limit: 10` and leave the schedule out for this first deploy. Then run
   `node --import tsx evals/contract.mjs`, followed by
   `cargo-ai cdk types && cargo-ai cdk check && cargo-ai cdk plan`. Show the diff and deploy with
   the play disabled. Never run `cargo-ai cdk init --force` in a non-empty directory.
6. **Run ten, then open it up.** Follow [`references/run.md`](references/run.md): sync ten, enable
   and execute the play once, and report every run with its route and CRM links. Only on an
   explicit yes after that, set the approved `limit`, add the cadence, and redeploy. Walk
   _Done when_ line by line and report each with evidence. Deployed cleanly and produced nothing is
   the normal failure.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the ones marked
_asked_ genuinely live in the operator's head.

| Input               | Kind    | How it is answered                                                                                                                                                                                                         | Why it matters                                                                                                                                                       |
| ------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crm`               | derived | Inspect the authenticated connectors. If more than one CRM is connected, ask which one is the system of record                                                                                                              | The lookups, the routing signal, the contact key and the task all change with it, together                                                                           |
| `market`            | derived | Titles, industries, headcount band and locations, read from the ICP in the workspace context. Ask for exactly these four only when no ICP exists and no company domain can be researched, then write them to `context/icp.md` | It is the audience. The qualifier reads the same ICP, so a market that lives only in a URL leaves the agent judging against nothing                                  |
| `search_size`       | derived | `searchPersonMetrics` on each candidate URL, as in references/search.md                                                                                                                                                     | Above 2,500 a single URL silently stops at 2,500 and the rest of the market is never seen                                                                            |
| `cadence`           | asked   | Whether it should run on its own, and how often. Default: every two weeks (the 1st and the 15th). The alternative is on demand                                                                                              | Every sync re-extracts and re-bills the whole search, so cadence is the main cost dial, traded against how fresh a new hire is when the owner hears about it         |
| `new_account_owner` | asked   | Pick from the CRM's live owner list (HubSpot owners, Salesforce users, Attio members)                                                                                                                                       | A new account has no owner, and a task with no owner lands in nobody's queue                                                                                         |
| `person_dedupe`     | asked   | One contact per person (default: a mover's existing record is moved to the new account) or a new contact per company. Ask; do not assume                                                                                    | Teams disagree on it, and it decides whether a person's history follows them or stays with their previous company                                                  |
| `csm_owner_field`   | derived | Find the company property holding the CSM as an owner in the live schema and set `csmOwnerProperty`. Ask "which field holds the CSM?" only when none is obvious                                                              | The customer task goes to the CSM; with no field it falls back to the account owner, which is right only if the owner is the CSM                                     |
| `routing_signal`    | derived | HubSpot: confirm `lifecyclestage` is populated on companies. Salesforce: check `Account.Type`; fall back to the opportunities. Attio: the deal stage or a status attribute                                                  | A switch on a field nobody maintains routes everything to "known account" and the open-deal alert never fires                                                       |
| `contact_key`       | derived | The CRM fields holding a LinkedIn identity: `hs_linkedin_url` on HubSpot (plus a LinkedIn ID property if the portal has one), a custom field on Salesforce. The lookup searches four URL forms (`infra/scripts/lookup.ts`); check the stored shape is one of them | It is the person lookup. A stored shape the lookup does not search finds nobody, so every mover reads as a stranger and gets duplicated                             |
| `find_email_tool`   | derived | Instantiate Cargo's native Find Email tool, confirm its live inputs and output path, and replace `REPLACE-WITH-FIND-EMAIL-TOOL-UUID`                                                                                        | A guessed input name returns no email on every run while the contacts still get created, keyed on LinkedIn only                                                    |

Checked before moving on, not after the deploy:

- `market`: every facet value is an id from an autocomplete, titles are quoted, and the three
  job-change filters are still in every URL
- `search_size`: counted for the URLs actually being deployed, each under 2,500
- `routing_signal`: populated on most accounts, or the routing was moved to deals
- `contact_key`: exists on the contact object and is the field the existence check reads

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the default.

| Variation              | When it is right                                                                                    | How                                                                                                                                                                           | What it costs                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crm_shape`            | The system of record is Salesforce or Attio                                                         | Follow `references/crm-adaptation.md`: connector, lookups, routing signal, contact key and task together (`infra/connectors/crm.ts`, `infra/plays/route-new-hires.ts`)       | Field names vary per org, so each one is read from the live schema and reverified in the pilot                                                                |
| `cadence`              | The market is small and a weekly signal matters, or the budget is tight and monthly is enough       | Change the model's cron (`infra/models/new-hires.ts`), or remove it for on-demand syncs before the first deploy                                                               | Weekly roughly doubles the extraction spend of the default for the same people found; monthly halves it and the owner hears about a new hire weeks later      |
| `split_search`         | The counted search is above 2,500                                                                   | One URL per region or headcount band in `urls` (`infra/models/new-hires.ts`), each counted                                                                                    | More URLs to keep in sync with the ICP; overlapping splits extract the same person twice and bill both                                                         |
| `csm_queue`            | Customer success works from a pooled queue rather than a named CSM per account                      | Put the customer task in a HubSpot task queue instead of on the CSM field (`infra/plays/route-new-hires.ts`)                                                                  | Nobody is named, so the task waits until someone picks it up                                                                                                 |
| `contact_per_company`  | The team keeps one contact per person per company, so history stays with the old employer           | Drop the person lookup's match from the contact write and key on email or LinkedIn URL only, and stop only when the person is on this account (`infra/plays/route-new-hires.ts`) | Two records per mover; reporting on a person spans both, and the move is no longer noted on the task                                                          |
| `match_on_name`        | The CRM holds few LinkedIn URLs, so movers are rarely found                                          | Add first and last name as a criterion, and accept the match only when the found contact's company matches the one the person just left                                     | Namesakes: a common name matches a stranger, and moving their record corrupts it. Never name alone                                                             |
| `route_on_deals`       | HubSpot `lifecyclestage` is not maintained, or the open-deal task should reach the deal owner       | Search deals associated with the company, route on open versus won, and assign that route's task to the deal owner (`infra/plays/route-new-hires.ts`)                        | One more lookup per existing-account run, and the deal association has to be read reliably                                                                    |
| `task_known_accounts`  | Known accounts without a deal are not worked by any motion, and someone should be told              | Add a task for the account owner on the known-account route, as on the customer route (`infra/plays/route-new-hires.ts`)                                                       | The largest bucket in most markets starts raising tasks; owners who already work these accounts will read most of them as noise                              |
| `draft_first_touch`    | The team wants the email written, not just the task                                                 | Add a writing agent after the contact write on the new-account route and put its draft in the task body                                                                       | One more LLM call per new account, and copy that has to be reviewed before it is trusted. The play still sends nothing                                        |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The three job-change filters stay in every search URL.** (`infra/models/new-hires.ts`)
  Recently changed jobs, under a year at the company, under a year in the position. Remove one and
  internal promotions at long-tenured employees flood in, read as new hires, and raise tasks about
  people who have been at the account for a decade.
- **Enrich the company first, match on the domain second, and stop when there is no domain.**
  (`infra/plays/route-new-hires.ts`) A Sales Navigator lead has a company URL, not a domain. Without
  the guard, an empty domain matches no account on HubSpot (so it looks new and gets created) and
  every account on a `contains` lookup in Salesforce (so the first one in the org wins).
- **The qualifier runs on the new-account route only, and its verdict gates every write.**
  (`infra/plays/route-new-hires.ts`, `infra/agents/icp-qualifier.ts`) Without the gate every company
  in the market lands in the CRM and the play becomes a pollution machine. Qualifying customers and
  open deals wastes a call and can drop an account somebody already sold.
- **The ICP lives in the workspace context, not in the prompt.** (`infra/agents/icp-qualifier.ts`)
  In the prompt, changing who qualifies becomes a deploy, and the search and the qualifier drift
  apart because they no longer read the same file.
- **The person is looked up before anything is written, and a contact on the same account stops the
  run.** (`infra/plays/route-new-hires.ts`) Someone already on the account is not news; without the
  stop every sync pays for their email again and raises a task the owner does not need. And without
  the lookup, a person who moved gets a second contact while their old one sits on a company they
  left.
- **Every task names an owner and sits on the account.** (`infra/plays/route-new-hires.ts`) The
  deal route goes to the account owner, the customer route to the CSM with the owner as fallback. A
  task with no owner is in nobody's queue, and one not attached to the account is invisible to the rep
  who opens it. HubSpot cannot attach at insert, so the association nodes stay.
- **`changeKinds: ["added"]` stays.** (`infra/plays/route-new-hires.ts`) Each sync re-extracts the
  whole search. Without `added`, every sync re-routes everyone in it, re-pays for every enrichment
  and every email, and raises the same tasks again.
- **Lookups never use SOQL.** (`references/crm-adaptation.md`) On Salesforce they are `findRecords`
  or `searchRecords`. A hand-written query skips field validation, so a misspelled field or an
  unquoted domain returns nothing at run time and routes everyone down the wrong branch while every
  run reports success.
- **The play ends at the CRM write.** Sending belongs to the team's own sequencer, after a person
  has read the task. A play that sends on a job-change signal mails people on their first week with
  nobody reviewing it.

## Done when

- each deployed search URL was counted with `searchPersonMetrics`, sits under 2,500, and keeps the
  three job-change filters
- the pilot synced ten rows whose columns match the workflow input
- every run in the pilot ended in a named route and status, and every route the ten reached is
  shown with its CRM record links
- a new-account run shows the qualifier's verdict and rationale, and a declined company wrote
  nothing
- no account the CRM already held was created again
- every task carries an owner (the CSM on customers) and is attached to the account and the contact
- a person already on the account produced no task and no email lookup
- a person found at another company was moved, not duplicated, and the task says so
- `node --import tsx evals/contract.mjs` passes against the adapted resources
- after opening up, the next sync created runs only for people new since the previous one

## What it costs

Fetch live prices before every estimate: `cargo-ai connection integration get salesNavigator`,
`linkedin`, and the Find Email tool's template, plus the LLM connector's model. Quote the lookup
time with the estimate.

**Extraction is the main spend, and it repeats.** `fetchLeadSearch` bills per extracted lead, and
it is not incremental: every sync extracts the whole search again, including the people already in
the model. "Changed jobs" spans roughly the last 90 days, so a sync every two weeks re-pays for most
of the previous sync to find the ones who are new. One sync costs the counted search (capped at
`limit` per URL) times the per-lead price; a month costs that times the number of syncs.

**Routing is per new person, and only new people.** Each run pays one company enrichment. A
company not in the CRM adds one qualifier call; a qualified one adds an email lookup. An account
the CRM already holds adds an email lookup only when the person is not already a contact on it. The CRM
actions carry no per-call price of their own; confirm it with `cargo-ai connection integration get`
on the CRM's slug if the workspace's plan says otherwise.

**Counting is cheap and comes first.** One `searchPersonMetrics` call per candidate URL tells you
what a sync will extract before anything is extracted.

## Composes into

`crm-enrichment` (fills the contacts and accounts this play creates), `account-scoring` (a standing
score on the accounts it adds), and the team's own sequencer after a person reads the task.
`track-job-changes` is the sibling for people already in your CRM.
