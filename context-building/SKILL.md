---
name: context-building
description: 'Populate the knowledge layer at context/ from what the CRM says about won and lost deals, what the calls said, and what the company''s public surface says about itself: positioning, ICP with a disqualifier, three to five personas with title detection lists and buying roles, jobs to be done, alternatives, clients, proof, objections, signals and insights, every sentence tagged receipted, inferred or unknown, as one pull request; then a monthly agent appends what the new calls and deals taught, opens one pull request and posts a five-line digest to Slack, and an analyst answers from it in Slack. Triggers: "our context repo is empty", "populate the knowledge base from our website and CRM", "write our ICP from won and lost deals", "derive our personas from job postings", "keep the context repo current every month", "who do we sell to and why do we lose", "bootstrap the workspace context from acme.com". Cargo CDK, defineAgent, harness claudeCode, HubSpot, TheirStack, Slack, GitHub, cargo-ai CLI reads, context, cadence. Skip when: you want one ICP or persona file written by hand right now, which is cargo-context''s job with nothing deployed; or you want call transcripts scribed into the log every morning, which is call-capture.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli 1.0.89 or later with @cargo-ai/cdk 1.0.67 or later, a Cargo workspace, an authenticated Anthropic connector (the harness runs against Cargo's proxy), an authorized GitHub connector, a GTM repository with `context/` and `cadence/` at its root (the shape `cargo-ai cdk init` scaffolds), and a TheirStack connection for the persona pull. A CRM connection (HubSpot in the checked example) and call-capture are optional: without them the bootstrap runs in hypothesis mode. Nothing here needs a credential in .env."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/context-building
metadata:
  author: getcargo
  source: cookbook
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

# Context building

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

The knowledge layer at `context/` stops being a folder of templates. One agent runs once, by hand,
and populates ten domains: `global/` (positioning, value proposition, offerings), `icp/` with at
least one disqualifier, `persona/` (three to five, each with a title include list, a title exclude
list and the buying roles it holds in a won deal), `jtbd/`, `alternative/` (competitors, the status
quo and in-house), `client/`, `proof/`, `objection/`, `signal/` and `insight/`. Every factual
sentence carries an evidence tag: `[R: <source>]` receipted, with a count and its denominator where
there is one; `[I: <from what>]` inferred; `[TR: <what would settle it>]` unknown. Then it opens one
pull request and stops.

Where the evidence comes from is what decides how confident the files are. With a CRM connected
and twenty or more closed-won deals in the last twelve months, the run is in **verify mode**: the
ICP is derived from what separates won from lost, the personas are reconciled with the titles on
won deals, the buying roles come from who was on them, and the insights are dated and counted.
Without that, the run is in **hypothesis mode**: the same files, from the public surface and a
GTM profile method, every claim tagged inferred, and the operator confirms, edits and approves.
Opinionatedness scales with connectedness; nothing is stated with a conviction the data does not
hold.

Once a month a second agent reads the calls captured since the last run (through `call-capture`)
and the deals closed since the last run, appends dated insights, new objections, new clients and
proof, opens one pull request and posts five lines to Slack: calls read, deals won and lost, three
things learned, one proposed change if any, the link. It never edits `icp/` or `persona/`; a
change there is a proposal in the pull request body, and a human decides.

A third agent is the consumer: `@mention` it in Slack and it answers "who do we sell to and why do
we lose?" strictly from `context/`, citing the file, and names the missing file when it cannot.

This is a research sprint, a monthly review and a Slack bot, collapsed into three declared
resources, two collector scripts and one pull-request write path. `harness: "claudeCode"` is what
buys the working tree: the output of a bootstrap is thirty to sixty markdown files, and only an
agent with a checkout can produce that diff.

Three properties make it safe enough to run unattended:

- **The collection is deterministic.** The agent does not read the CRM or TheirStack. `scripts/collect/crm.ts`
  and `scripts/collect/jobs.ts` do, the same way every time, and the agent is told not to
  improvise that step. The budget for the persona pull is read from the workspace and computed by
  code, never estimated by the model.
- **The pull request is the gate.** The agents have repository write access, and the refresh has
  one locked Slack channel. Neither writes the workspace context directly, touches the CRM, emails
  anyone, or merges itself. A merge, then the next `cargo-ai cdk deploy`, syncs `context/` into
  the workspace.
- **Derive before you ask.** The bootstrap stops exactly twice: once to confirm three lines (target
  market, personas, competitors) and once for the persona and reference-permission questions.
  Everything else is looked up.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it, the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/context-building` writes this example to `infra/context-building/`
   (resources **and** `scripts/`) and this procedure to `.claude/skills/context-building/`. No
   project yet? `cargo-ai cdk init <dir> --cookbook context-building && cd <dir> && npm install`
   does both; this folder never ships a shell. **If you are reading this from the project's
   `.claude/skills/`, the install already happened: start at step 2.** On a CLI too old to have
   `add`, copy this folder in as a sibling of what is there by hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** If the project already has a GitHub, Slack,
   Anthropic or TheirStack connector or an agents folder, rewire the imports to the existing one
   and drop the copy; two resources with one slug is a collision at deploy. If `ask-cargo` or the
   `gtm-knowledge-graph` example is installed, its Slack agent overlaps the analyst: split by
   channel (a channel listed on the analyst is left to it by an `allChannels` trigger elsewhere),
   or drop the analyst. The knowledge layer needs no work: the scaffold already declares the repo's
   root `context/` in `infra/context.ts`, and `defineContext` is a per-workspace singleton, which is
   why this folder ships none. **Append nothing to `.env.example`:** nothing here holds a
   credential.
3. **Run the CRM audit by hand once.** From the repository root,
   `npx tsx scripts/context-building/collect/crm.ts --dry-run` prints the closed, won and lost
   counts in the window, the pipelines it found and the mode. Read it: the mode is the single most
   consequential derived value in this cookbook, and a `hypothesis` on a workspace you know has
   the deals means the wrong CRM connection was picked or the window is wrong. Then drop
   `--dry-run` and confirm `cadence/log/raw/crm/<today>.json` carries real deal names. With no CRM,
   it prints `mode: hypothesis` and writes nothing; that is a result, and step 5 proceeds from the
   website alone. Set `LOST_REASON_PROPERTY` in `scripts/context-building/collect/config.ts` when
   the fill rate reads 0 of N: that is a custom property, not a team that never records reasons.
4. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted (nobody asks for a variant they do not know exists); _What you will be asked_ is
   the floor, and you derive before you ask. If you are asking more than about four questions at
   one stop you have skipped lookups. Set the two Slack channel ids and the model. Record what you
   changed and why under a `## Decisions` section in your copy of this file.
5. **Plan, then stop.** `npm run check && cargo-ai cdk plan` (`check` validates the resource tree
   offline; the blank template ships it). Show the diff: three agents, four bound connectors, one
   folder, and no model. Deploy only on an explicit yes: `cargo-ai cdk deploy`. Never
   `cdk init --force` into a non-empty directory.
6. **Run the bootstrap, and answer it twice.** Start it from the workspace UI or with
   `cargo-ai ai message create --agent-uuid <uuid> --parts '[{"type":"text","text":"Run the context bootstrap. Follow your system prompt exactly and open one pull request."}]'`,
   then answer its two stops in the same chat (`--chat-uuid` from the first reply). It reads the
   workspace name back, prints the mode, what is connected and the skip list, crawls, presents
   three lines, writes, pulls the personas' postings inside the budget, asks the persona and
   reference questions, and opens the pull request.
7. **Verify.** Walk _Done when_ line by line and report each with evidence. Deployed cleanly and
   produced nothing is the normal failure, and the second normal failure is a pull request of
   sixty files nobody reads: check the tag counts in its body before you call this done.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the rows marked
_asked_ genuinely live in the operator's head, and the bootstrap asks them at its two stops, never
elsewhere. Show candidates before asking for a choice.

| Input                                                                  | Kind      | How it is answered                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Why it matters                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| workspace and company domain                                           | value     | **derived** from `cargo-ai whoami` and the project's `context/global/` (else its README); the name is read back in the first message. **asked** only when the name is generic (Main, Test, a person's name) and nothing in the repo names a domain.                                                                                                                                                                                                                                              | Every file written is about this company. A wrong domain is a wrong knowledge base, and it is the one mistake nobody notices until the analyst quotes it.                                                                                                                                       |
| connected systems                                                      | value     | **derived**: `cargo-ai connection connector list` for the CRM, Slack, GitHub, the LLM and TheirStack; `scripts/call-capture/` existing for the call recorder. **asked** once, in the pull request rather than as a question, for what is missing: connect it now (`cargo-ai cdk add connector/<integration>`) or run without.                                                                                                                                                                       | The mode and the tag on every claim follow from what is connected. Asking "do you have a CRM?" of a workspace whose connector list already says so is the lookup this table exists to prevent.                                                                                                   |
| material to ingest                                                     | manual    | **asked** once, at the first stop with the three lines: ICP or persona documents, decks, battlecards, a pricing sheet, Notion pages. Each becomes a receipt tag on what it supports.                                                                                                                                                                                                                                                                                                              | The one input with no lookup anywhere: what the team already wrote down lives on their drive. Ingested, it turns an inferred claim into a receipted one; not offered, the bootstrap re-derives it from the website and tags it inferred.                                                        |
| mode                                                                   | value     | **derived** by the CRM collector: `verify` when it reports 20 or more closed-won deals in the last twelve months (`VERIFY_MIN_WON` in `scripts/context-building/collect/config.ts`), else `hypothesis`. Never asked.                                                                                                                                                                                                                                                                             | Verify mode states insights with conviction because they are read from the team's own deals; hypothesis mode marks everything inferred and the operator confirms, edits and approves. The line is a number so nobody argues it per run.                                                        |
| credit budget for persona pulls                                        | value     | **derived** by `scripts/context-building/collect/jobs.ts` from `cargo-ai billing subscription get` (the balance), `cargo-ai connection integration get theirStack` (the per-posting price) and `cargo-ai connection connector list` (whether the bound TheirStack connector bills credits at all). Own key: 40 per persona, up to 80 when saturation is not reached. Credits: half the balance kept back, the rest divided across the personas, skipped under 15. The rule is `collect/budget.ts`. | Billing is per returned posting, so the limit is the whole cost. Read at run time and stated per record, never as a fixed total in this file: a free plan and a paid one get different pulls from the same code, and neither is asked to guess.                                                 |
| target market, target personas, key competitors                        | generated | **derived** from the GTM profile method and the crawl, and in verify mode from what separates won from lost and the titles on won deals. **asked** as three lines to confirm or correct, at the first stop. Nothing else is asked there.                                                                                                                                                                                                                                                          | These three lines seed `icp/`, `persona/` and `alternative/`, so a wrong one propagates into thirty files. Showing the candidates is what makes the answer a correction rather than a blank-page question.                                                                                     |
| `icp/`                                                                 | generated | **derived**: the account-scoring rule. Won versus lost separates industry, size, geography and stack, and the file names at least one disqualifier: a profile that looks like a fit and loses. Hypothesis mode writes the profile method's fit conditions and its "looks like fit, is not", tagged inferred.                                                                                                                                                                                       | The disqualifiers are the half of an ICP that protects the team's time, and the half a crawl never produces on its own. An ICP without one scores every look-alike as a fit.                                                                                                                    |
| CRM hygiene findings                                                   | value     | **derived** by the CRM collector and **stated** at the first stop with the three lines, never asked and never worked around silently: the lost-reason fill rate ("lost reason on 37 of 154 lost deals") and the deal-to-contact association rate ("contacts on 202 of 280 closed deals").                                                                                                                                                                                                                                                | The first decides whether objections can come from the CRM at all or only from calls. The second says how many closed deals are blind for stakeholder mapping, so the persona reconciliation and the buying roles are read against the right denominator.                                        |
| pipeline and won stage                                                 | value     | **derived** by the CRM collector from the deals' own won and lost flags, so no stage name is ever asked. **asked** only when the snapshot lists more than one pipeline: which one is the sales pipeline. The window is always the last twelve months (`WINDOW_DAYS`).                                                                                                                                                                                                                              | Partner, renewal and support pipelines close deals too, and they are not the same evidence. One pipeline needs no question; two need exactly one.                                                                                                                                              |
| `persona/`                                                             | generated | **derived**: one pull per confirmed persona through TheirStack, size filtered at pull time inside the ICP band, postings read in batches of 15 to 20 until two consecutive batches change nothing. **asked** at the second stop, after drafting: which personas are real, which merge or split; in a typical won deal, who champions and who signs.                                                                                                                                              | A persona without a title include and exclude list cannot be detected by any classifier and is not done. Merging and splitting is a judgement about the team's market that postings cannot settle, so it is the one persona question left to the operator.                                     |
| `insight/`, `objection/`                                               | generated | **derived** from the call entries `call-capture` wrote and from the CRM snapshot, framed as who we talk to, what we talk about, where we win, where we lose; dated, with counts and denominators, `confidence: validated` only on two independent occurrences.                                                                                                                                                                                                                                    | Insights are what the monthly refresh diffs against. Without dates and denominators the refresh cannot tell change from guess.                                                                                                                                                                  |
| `client/`, `proof/`                                                    | generated | **derived** from the case-study and customers pages, one client node and its proof nodes each. **asked** once, at the second stop: which customers can be named to prospects, which are internal only; becomes `reference_permission: named \| internal` on every client and proof file.                                                                                                                                                                                                          | A proof point an outbound agent may quote and one it may not look identical on the page. The permission field is what every downstream consumer filters on.                                                                                                                                    |
| Slack channels (`infra/agents/context-refresh.ts`, `gtm-analyst.ts`)   | value     | **asked**: the channel the digest lands in, locked on the refresh's `postMessage` use; the channels the analyst answers in, listed on its trigger. Ids (`C…`), not names.                                                                                                                                                                                                                                                                                                                         | The digest channel is locked so the agent cannot pick a customer shared channel; the analyst's list is what keeps it from quoting the objection file to a customer.                                                                                                                             |
| repository binding (`infra/agents/context-bootstrap.ts`, `context-refresh.ts`) | value | **derived**: leave `repository`, `defaultBranch` and `connector` unset and `plan` fills them from the git origin of the checkout, taking the GitHub connector from the project's own. `cargo-ai cdk check` prints what it resolved: confirm the line reads your repo and the repository root.                                                                                                                                                                                                       | This is the working tree both harness agents clone and the only place their output can land. A binding rooted at `infra/` has no node_modules, so the collectors cannot run and the run reports clean and empty.                                                                                |
| LLM connector and model (`infra/connectors/anthropic.ts`)              | value     | **derived**: `cargo-ai connection connector list` shows whether an Anthropic connector is authorized; if not, `cargo-ai cdk add connector/anthropic` takes the key. Any Anthropic model pairs with `claudeCode`; each agent's `languageModel` is a placeholder to set.                                                                                                                                                                                                                             | A harness does not bring its own model; this is what the runs are billed and metered against. Pair `claudeCode` with an `openAi` connector and it typechecks green and fails at deploy.                                                                                                        |

Checked before moving on, not after the deploy:

- `cargo-ai whoami` name read back, and it matches the domain
- the CRM collector ran by hand once and wrote a real JSON, or the mode is `hypothesis` on purpose
  and the pull request will say so
- the two hygiene findings in that JSON, lost-reason fill and deal-to-contact association, are
  numbers you can say out loud with their denominators; the bootstrap states both at its first stop
- `cargo-ai cdk check` prints both harness agents bound to the repository root, not `infra/`
- exactly one `defineContext` in the project, the scaffold's, resolving to the root `context/`
- `scripts/context-building/collect/personas.ts` still holds the placeholder personas: the
  bootstrap replaces them, nobody edits them ahead of the three-line confirmation
- `cargo-ai cdk plan` reports no model: a persona model here bills its first pull at deploy
- both Slack channel ids are ids, not names, and neither is a customer shared channel

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the
default.

| Variation                   | When it is right                                                                                                    | How                                                                                                                                                                                                                                                                | What it costs                                                                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bootstrap-from-slack`      | The operator would rather answer the two stops in a Slack thread than in a CLI chat                                 | Add an `agentConnectorTrigger({ connector: slack, config: { channelIds: [...] } })` to `infra/agents/context-bootstrap.ts`, one private channel, and start it with an @mention                                                                                       | Anyone in that channel can start a crawl and a pull. Keep it to one channel with the people who would answer the questions, or the budget rule is the only thing between a teammate and a re-run                                                                             |
| `standing-persona-models`   | You want new postings per persona flowing every month, for signals and for the refresh                              | After the bootstrap, declare one `personaJobsModel(...)` per confirmed persona in `infra/models/persona-jobs.ts` from the entry in `scripts/collect/personas.ts`, add the models folder, add a monthly `schedule`, deploy. `references/persona-pulls.md` has the steps | The first run at deploy re-bills the postings the bootstrap already read. After that the extractor is incremental and only new postings bill. A model created some other way is not adopted by the declaration: the deploy stops on `duplicateSlug` and needs `cdk import` |
| `raise-the-verify-line`     | Twenty wins is too few to separate won from lost in your market (long cycles, few large deals)                      | Raise `VERIFY_MIN_WON` in `scripts/context-building/collect/config.ts`                                                                                                                                                                                             | More workspaces land in hypothesis mode, and the ICP stays tagged inferred until the CRM catches up. The operator approves more and the files assert less                                                                                                                  |
| `wider-window`              | Your sales cycle is longer than a year, or last year was not representative                                         | Raise `WINDOW_DAYS` in the same file                                                                                                                                                                                                                                | Older deals describe an older market. The insight dates say so, but the ICP does not, and a two-year window on a company that repositioned last spring writes the old ICP with conviction                                                                                   |
| `another-crm`               | The deals live in Salesforce or Attio                                                                               | Write `scripts/collect/crms/<slug>.ts` satisfying `Crm` and register it in `crms/index.ts`; set `CRM` in `config.ts`. `references/crm-audit.md` names the objects and fields                                                                                        | Written from API docs until it has run against a live workspace, and the collector says so on every run. Check `--dry-run` reports real counts before trusting a snapshot                                                                                                  |
| `no-persona-pull`           | No TheirStack connection and no appetite for one, or the personas are already documented                            | Delete `infra/connectors/theirstack.ts` and skip step 7 of the bootstrap prompt; the personas are written from the careers pages and the titles on won deals                                                                                                        | Pains, KPIs and responsibility language come from postings, not from titles. The persona files carry `[I]` where the postings would have put `[R]`, and the messaging built on them is weaker for it                                                                       |
| `two-stops-into-one`        | The operator is not available twice and accepts the drafted personas as they are                                    | Merge step 8's questions into step 5 in `context-bootstrap.prompt.ts`: ask reference permission and the champion/signer question with the three lines                                                                                                               | The persona merge/split question is answered before the postings were read, so it is answered about candidates, not drafts. Expect one round of corrections on the pull request instead                                                                                     |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The one-PR write path.** (`infra/agents/context-bootstrap.ts`, `context-refresh.ts`) No agent
  here writes the workspace context directly, and neither has a `context` capability with write
  access: the repository is the source and `cargo-ai cdk deploy` syncs it. Give an agent
  `cargo-ai context runtime write` and the knowledge layer has two sources of truth; the next
  deploy overwrites whichever one a human did not see.
- **The agents do not fetch; the scripts do.** (`scripts/collect/crm.ts`, `scripts/collect/jobs.ts`)
  A fetch loop an agent re-derives is a fetch loop that silently changes shape: a window that
  drifts, a filter that quietly widens, a pull that grows past the budget on a day the model was
  less careful. The snapshot is what every refresh is diffed against, so its rules have to be
  identical every run.
- **Derive before you ask, and the three-line confirmation stays three lines.**
  (`context-bootstrap.prompt.ts`) More than about four questions at one stop means a lookup was
  skipped. Add a fourth line to the confirmation and the operator starts answering instead of
  correcting; the candidates are the value, the question is the ceremony.
- **Size is filtered at pull time through `companyFields`, never after.** (`scripts/collect/personas.ts`,
  `infra/models/persona-jobs.ts`) Billing is per returned posting. Filter after the pull and every
  row outside the band was paid for and thrown away, and the budget rule sized a pull that reads
  half as many postings as it bought.
- **The budget is read and computed, never estimated.** (`scripts/collect/budget.ts`,
  `scripts/collect/jobs.ts`) The balance, the price and whether the connector bills credits come
  from the workspace at run time, and `--over-budget` is the operator's word, never the agent's.
  Put a limit in the prompt and a free plan spends its bootstrap on one persona.
- **Personas ship with detection lists or are not done.** (`context-bootstrap.prompt.ts`) A
  persona file without a title include and exclude list cannot be used by any classifier, scorer
  or router, and the next cookbook that needs one re-derives it from the same postings.
- **The refresh never edits `icp/` or `persona/`.** (`context-refresh.prompt.ts`) They are what
  the scorer and every outbound agent key on. A monthly agent quietly rewriting them is how a
  knowledge base drifts without anyone deciding it should; a proposal in the pull request body is
  how it changes on purpose.
- **Idempotent: seeded domains are skipped, and the skip list is printed first.**
  (`context-bootstrap.prompt.ts`) A domain with two or more entries is left alone entirely; one
  entry gets new files and no edit. Drop the rule and a re-run overwrites the ICP a human refined.
- **Persona files are product-free except one final derived section.** (`context-bootstrap.prompt.ts`)
  Everything above "How we land" describes the job, not what is sold to it. Let the product into
  the pains and the KPIs and the persona stops being evidence about the buyer and becomes a pitch
  the analyst quotes back as fact.
- **Evidence tags on every factual sentence, and missing evidence is never contradicting
  evidence.** (`context-bootstrap.prompt.ts`, `context-refresh.prompt.ts`) `[R]` with a
  denominator, `[I]` with what it was inferred from, `[TR]` with what would settle it. Untagged,
  the refresh cannot tell change from guess and the analyst cannot say how sure it is.
- **No persona model deploys by default.** (`infra/models/persona-jobs.ts`) A model runs at
  creation and bills `limit` postings before anyone confirmed the persona. Declare one after the
  bootstrap, for a persona worth watching.
- **`scripts/context-building/package.json` stays.** (`scripts/package.json`) The CDK loader
  imports every `.ts` under the project root except directories carrying one; delete it and
  `cargo-ai cdk plan` runs the CRM audit against the live CRM on every plan.
- **The harness root stays the repository root.** (`infra/agents/context-bootstrap.ts`) That is
  where `node_modules` is, so it is the only place `npx tsx …/collect/crm.ts` resolves, and where
  `context/` and `cadence/` live. `cargo-ai cdk check` prints the resolved binding; a line ending
  `in infra/` means the collectors cannot run and the bootstrap writes from the website alone
  while reporting clean.

## Done when

- `npx tsx scripts/context-building/collect/crm.ts --dry-run` printed real counts and the mode,
  and the run without it wrote `cadence/log/raw/crm/<today>.json` with real deal names, a
  lost-reason fill rate, an association rate and titles on won deals; or it printed
  `mode: hypothesis` because no CRM is connected, and the pull request says so
- `npx tsx scripts/context-building/collect/jobs.ts --dry-run` printed a per-persona limit and the
  reason, read from the workspace, and nothing in this folder states a credit amount
- `cargo-ai cdk check` prints both harness agents bound to the repository root, and
  `cargo-ai cdk plan` reports three agents, four bound connectors, one folder and no model
- the first stop stated the two CRM hygiene findings with their denominators (lost-reason fill,
  deal-to-contact association) before the three lines, or said there is no CRM
- from a fresh project in hypothesis mode, one run of the bootstrap agent opened one pull request
  touching all ten domains, every factual sentence tagged, and the operator was asked at most the
  questions in the table, at two stops
- in verify mode, `icp/` names a disqualifier derived from won versus lost, every persona file
  reconciles with the titles on won deals or says `[TR]` where it does not, and `insight/` holds
  dated entries in the four buckets with counts and denominators
- every persona file has a title include list, a title exclude list and a buying roles section,
  and nothing above "How we land" names the product
- every `client/` and `proof/` file carries `reference_permission: named` or `internal`
- the pull request body states files per domain, tag counts (receipted, inferred, unknown), the
  credit spend per persona pull, and the questions asked with their answers
- the analyst, asked "who do we sell to and why do we lose?" in its channel, answers from `context/`
  with file citations, and asked something the files do not cover names the missing file
- the refresh agent, against a project with new calls and deals, opened a pull request that adds
  files and modifies none under `icp/` or `persona/`, and its Slack digest is five lines ending
  with the pull request link
- after merging and `cargo-ai cdk deploy`, a changed `context/` file is readable from the workspace
  context repository and the analyst quotes it back

## What it costs

The CRM audit is free: `hubspot.searchRecords` bills no credits, and it is a few hundred reads at
most, paced. The crawl is the harness's own fetches. The persona pull is the one deliberate spend
and it is per returned posting: `scripts/context-building/collect/jobs.ts` reads the price and the
balance at run time and prints what each pull will cost before it runs, and a TheirStack
connection carrying its own key bills TheirStack's plan rather than Cargo credits. Three to five
personas at the default per-persona limit is the whole bootstrap.

The recurring cost is two harness runs: the bootstrap once, and the refresh monthly, scaling with
how many call entries and deals landed since the last one. The analyst is one LLM call per
question.

## Composes into

`account-scoring` (its ICP row is this cookbook's `icp/`, disqualifier included), `call-capture` (the
call entries this reads every month, and the objection files both promote into),
`monitor-buying-signals` and `tam-building` (the `signal/` candidates and the ICP band this writes
are what a feed watches for and a sourcing filter narrows to), `ask-cargo` and any agent with the
`context` capability (they answer from what this keeps current).

## Decisions

Three places this cookbook departs from the design it was built from, each for a reason verified
against a live workspace on 2026-09-29. An adapter records its own under this heading.

- **The persona pull is the `searchJobs` action through a script, and no persona model deploys by
  default.** The design declared one `defineModel` per persona on the `fetchJobs` extractor, two
  shipped as placeholders. Verified: a model runs at creation (the first storage run starts in the
  same second the model is created), so a placeholder bills `limit` postings at deploy before any
  persona is confirmed; and a model created at run time by a script is not adopted by a later
  declaration with the same slug, the deploy stops on `duplicateSlug` and the only way out is
  `cargo-ai cdk import`. The action takes the same `fields`, `companyFields` and `limit`, returns
  the same rows with `company_object` on every one, and needs nothing deployed, which is what lets
  the postings and the persona files land in one pull request. `infra/models/persona-jobs.ts`
  keeps the standing model as an opt-in built from the same spec.
- **No CRM connector resource.** The design listed `connectors/crm.ts` bound to the workspace's
  CRM. A bound connector declares no `config` to typecheck and fails at deploy when the workspace
  holds no such connection, which is exactly the hypothesis-mode entry path this cookbook must
  deploy on. The CRM audit resolves the CRM at run time from `cargo-ai connection connector list`
  instead, and reports `mode: hypothesis` with no connection rather than failing.
- **Detection lists and buying roles are body sections on the persona file, not frontmatter
  fields.** The persona method they come from keeps them in frontmatter (`title_exact`,
  `title_exclude`, and so on). The scaffold's context lint and `persona/_template.md` know only
  `title`, `description` and `references`, and the scaffold's own rule is "do not invent
  frontmatter fields". They live under `## Detection`, `## Buying roles` and `## Evidence` at the
  end of the file, where a classifier reads them as lists and the lint reads them as prose.
