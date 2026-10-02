---
name: context-seeding
description: 'Seed the knowledge layer at context/ from the company''s public surface alone: positioning, value proposition and offerings, an inferred ICP with a disqualifier, three to five personas from job postings with title detection lists, jobs to be done, competitors and the status quo, clients and proof from the case studies, and signal candidates, every sentence tagged receipted, inferred or unknown, as one pull request. Runs once by hand, or at workspace setup with no questions asked. Triggers: "our context repo is empty", "seed the context from our website", "set up the workspace context from acme.com", "write a first ICP and personas from our public pages", "derive our personas from job postings", "we have no CRM yet, start the knowledge base from what is public". Cargo CDK, defineAgent, harness claudeCode, TheirStack, GitHub, cargo-ai CLI reads, context. Skip when: you want one ICP or persona file written by hand right now, which is cargo-context''s job with nothing deployed; or you want the ICP verified against won and lost deals, which is crm-context.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli 1.0.89 or later with @cargo-ai/cdk 1.0.67 or later, a Cargo workspace, an authenticated Anthropic connector (the harness runs against Cargo's proxy), an authorized GitHub connector, a GTM repository with `context/` at its root (the shape `cargo-ai cdk init` scaffolds), and a TheirStack connection for the persona pull. Nothing here needs a credential in .env, and nothing here reads a CRM, a call or Slack."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/context-seeding
---

# Context seeding

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

The knowledge layer at `context/` stops being a folder of templates, from one source: what the
company says about itself in public, plus the job postings that describe the people it sells to.
One agent runs once and writes eight domains: `global/` (positioning, value proposition,
offerings), `icp/` as an inferred profile with at least one disqualifier, `persona/` (three to
five, each with a title include list, a title exclude list and the buying roles the postings
suggest), `jtbd/`, `alternative/` (competitors, the status quo and in-house), `client/`, `proof/`
and `signal/` candidates. Every factual sentence carries an evidence tag: `[R: <url>]` receipted
by a page, with a count and its denominator where there is one; `[I: <from what>]` inferred;
`[TR: <what would settle it>]` unknown. Then it opens one pull request and stops.

Everything it writes is a hypothesis, and says so: public sources count as one source, so every
`proof/`, `signal/` and `icp/` file is `confidence: hypothesis`. That is the point of keeping this
cookbook on the public surface only. The CRM, the calls and Slack each belong to a cookbook of
their own, and their evidence is what later verifies or replaces what this one seeded. Nothing
here reads them, and nothing here mentions them to the agent.

It runs two ways. From a chat, it stops twice: once to confirm three lines (target market,
personas, competitors) and once for the persona and reference-permission questions. At workspace
setup, it asks nothing: the three lines and the questions go into the pull request body under
"Questions for the reviewer", reference permission stays unknown, and the pull request is the
conversation. A domain in, a knowledge layer out, for a workspace that connected nothing yet.

This is a research sprint collapsed into one declared resource, one collector script and one
pull-request write path. `harness: "claudeCode"` is what buys the working tree: the output is
thirty to sixty markdown files, and only an agent with a checkout can produce that diff.

Three properties make it safe enough to run unattended:

- **The one spend is deterministic and budgeted.** The agent does not pull postings.
  `scripts/collect/jobs.ts` does, sized by a rule that reads the balance and the price from the
  workspace at run time, and the agent is told not to improvise that step or pass the override.
- **The pull request is the gate.** The agent has repository write access and nothing else: no
  workspace context write, no CRM, no email, no Slack, no merge. A merge, then the next
  `cargo-ai cdk deploy`, syncs `context/` into the workspace.
- **Idempotent.** Seeded domains are skipped and the skip list is printed first, so a re-run when
  the site changes fills only what is empty and overwrites nothing a human refined.

## Example

> Our workspace is new and context/ is empty. Seed it from northwind.example, ask me the three lines, and open one pull request.

Illustrative output, fictional records:

```text
Workspace: Northwind (northwind.example). Mode: chat. Skip list: none, every domain is empty.

Target market: B2B SaaS, 50 to 500 employees, US and UK, selling through an AE team
Target personas: Head of Revenue Operations, Sales Operations Manager, VP Sales, GTM Engineer
Key competitors: Contoso Ops, Fabrikam Flow, the spreadsheet plus a RevOps contractor
Confirm or correct.

[context-seeding] northwind.example 2026-10-06
global/ 3 · icp/ 1 · persona/ 4 · jtbd/ 3 · alternative/ 5 · client/ 6 · proof/ 9 · signal/ 4
Tags: 41 receipted · 118 inferred · 12 unknown
Persona pull: 4 personas, 40 postings each, inside the 50 to 500 band, own-key connector
+ context/persona/head-of-revenue-operations.md
+   ## Detection
+   Title include: Head of Revenue Operations, Director of Revenue Operations, RevOps Lead
+   Title exclude: intern, analyst, assistant
+   ## Evidence
+   Pipeline accuracy named as a KPI in 27 of 40 postings [R: cadence/log/raw/jobs/head_of_revenue_operations.json]
```

Thirty-five files, every claim tagged, one pull request; the ICP carries a disqualifier and says a
CRM-reading cookbook is what verifies it.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it, the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/context-seeding` writes this example to `infra/context-seeding/`
   (resources **and** `scripts/`) and this procedure to `.claude/skills/context-seeding/`. No
   project yet? `cargo-ai cdk init <dir> --cookbook context-seeding && cd <dir> && npm install`
   does both; this folder never ships a shell. **If you are reading this from the project's
   `.claude/skills/`, the install already happened: start at step 2.** On a CLI too old to have
   `add`, copy this folder in as a sibling of what is there by hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** If the project already has a GitHub, Anthropic
   or TheirStack connector or an agents folder, rewire the imports to the existing one and drop the
   copy; two resources with one slug is a collision at deploy. The knowledge layer needs no work:
   the scaffold already declares the repo's root `context/` in `infra/context.ts`, and
   `defineContext` is a per-workspace singleton, which is why this folder ships none. **Append
   nothing to `.env.example`:** nothing here holds a credential.
3. **Dry-run the collector once.** From the repository root,
   `npx tsx scripts/context-seeding/collect/jobs.ts --dry-run` prints the per-persona limit and
   why: the balance, the price and whether the bound TheirStack connector bills credits, read
   live. A limit of 0 means the pull would be skipped and the personas would stay inferred; that
   is a fact about the balance, not a bug. No TheirStack connection: `cargo-ai cdk add
   connector/theirStack`, or take the `no-persona-pull` variation below.
4. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted (nobody asks for a variant they do not know exists); _What you will be asked_ is
   the floor, and you derive before you ask. If you are asking more than about four questions at
   one stop you have skipped lookups. Set the model. Record what you changed and why under a
   `## Decisions` section in your copy of this file.
5. **Plan, then stop.** `npm run check && cargo-ai cdk plan` (`check` validates the resource tree
   offline; the blank template ships it). Show the diff: one agent, three bound connectors, one
   folder, and no model. Deploy only on an explicit yes: `cargo-ai cdk deploy`. Never
   `cdk init --force` into a non-empty directory.
6. **Run it once.** From the workspace UI or with
   `cargo-ai ai message create --agent-uuid <uuid> --parts '[{"type":"text","text":"Run the context seeding for <domain>. Follow your system prompt exactly and open one pull request."}]'`,
   then answer its two stops in the same chat (`--chat-uuid` from the first reply). Add "setup
   mode" to the text and it asks nothing and writes its questions into the pull request.
7. **Verify.** Walk _Done when_ line by line and report each with evidence. Deployed cleanly and
   produced nothing is the normal failure, and the second normal failure is a pull request of
   sixty files nobody reads: check the tag counts in its body before you call this done.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the rows marked
_asked_ genuinely live in the operator's head, and the agent asks them at its two stops, never
elsewhere; in setup mode they are written into the pull request instead. Show candidates before
asking for a choice.

| Input                                                    | Kind      | How it is answered                                                                                                                                                                                                                                                                                                                                                           | Why it matters                                                                                                                                                                                                              |
| -------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| workspace and company domain                             | value     | **derived** from the message that started the run, else `context/global/`, else the repository README, else `cargo-ai whoami`; the name is read back in the first message. **asked** only when the name is generic (Main, Test, a person's name) and nothing names a domain. In setup mode with no domain, no pull request and a plain statement.                            | Every file written is about this company. A wrong domain is a wrong knowledge base, and it is the one mistake nobody notices until an agent quotes it.                                                                     |
| chat or setup mode                                       | value     | **derived** from the message that started the run: "setup mode", or a domain with an instruction to ask nothing, means setup. Never asked.                                                                                                                                                                                                                                   | Setup mode is what lets this run at workspace creation with nobody in the loop. The questions do not disappear; they move into the pull request body for the reviewer.                                                     |
| material to ingest                                       | manual    | **asked** once, at the first stop with the three lines: an ICP or persona document, a deck, battlecards, a pricing sheet. Each becomes a receipt tag on what it supports.                                                                                                                                                                                                   | The one input with no lookup anywhere: what the team already wrote down lives on their drive. Ingested, it turns an inferred claim into a receipted one.                                                                    |
| credit budget for the persona pull                       | value     | **derived** by `scripts/context-seeding/collect/jobs.ts` from `cargo-ai billing subscription get` (the balance), `cargo-ai connection integration get theirStack` (the per-posting price) and `cargo-ai connection connector list` (whether the bound TheirStack connector bills credits at all). The rule is `collect/budget.ts`; the SKILL states it per record, never as a total. | Billing is per returned posting, so the limit is the whole cost of the run. A free plan and a paid one get different pulls from the same code, and neither is asked to guess.                                              |
| target market, target personas, key competitors          | generated | **derived** from the GTM profile method and the crawl. **asked** as three lines to confirm or correct, at the first stop. Nothing else is asked there.                                                                                                                                                                                                                       | These three lines seed `icp/`, `persona/` and `alternative/`, so a wrong one propagates into thirty files. Showing the candidates is what makes the answer a correction rather than a blank-page question.                  |
| `icp/`                                                   | generated | **derived**: the profile method's fit conditions and its "looks like fit, is not" as the disqualifier, tagged inferred, with "How to identify" built from the profile's custom attributes.                                                                                                                                                                                  | A first ICP that a scorer can already read, honest about its source. The disqualifier is the half of an ICP that protects the team's time, and the half a crawl never produces unless asked.                                |
| `persona/`                                               | generated | **derived**: one pull per confirmed persona through TheirStack, size filtered at pull time inside the ICP band, postings read in batches of 15 to 20 until two consecutive batches change nothing. **asked** at the second stop, after drafting: which personas are real, which merge or split.                                                                              | A persona without a title include and exclude list cannot be detected by any classifier and is not done. Merging and splitting is a judgement about the team's market that postings cannot settle.                         |
| `client/`, `proof/`                                      | generated | **derived** from the case-study and customers pages, one client node and its proof nodes each. **asked** once, at the second stop: which customers can be named to prospects, which are internal only; becomes `reference_permission: named \| internal` on every client and proof file, `unknown` in setup mode.                                                             | A proof point an outbound agent may quote and one it may not look identical on the page. The permission field is what every downstream consumer filters on.                                                                 |
| repository binding (`infra/agents/context-seeding.ts`)   | value     | **derived**: leave `repository`, `defaultBranch` and `connector` unset and `plan` fills them from the git origin of the checkout, taking the GitHub connector from the project's own. `cargo-ai cdk check` prints what it resolved: confirm the line reads your repo and the repository root.                                                                                | This is the working tree the harness clones and the only place its output can land. A binding rooted at `infra/` has no node_modules, so the collector cannot run.                                                          |
| LLM connector and model (`infra/connectors/anthropic.ts`) | value    | **derived**: `cargo-ai connection connector list` shows whether an Anthropic connector is authorized; if not, `cargo-ai cdk add connector/anthropic` takes the key. Any Anthropic model pairs with `claudeCode`; the agent's `languageModel` is a placeholder to set.                                                                                                         | A harness does not bring its own model; this is what the run is billed and metered against. Pair `claudeCode` with an `openAi` connector and it typechecks green and fails at deploy.                                       |

Checked before moving on, not after the deploy:

- `cargo-ai whoami` name read back, and it matches the domain
- `cargo-ai cdk check` prints the agent bound to the repository root, not `infra/`
- exactly one `defineContext` in the project, the scaffold's, resolving to the root `context/`
- `scripts/context-seeding/collect/personas.ts` still holds the placeholder personas: the run
  replaces them, nobody edits them ahead of the three-line confirmation
- `cargo-ai cdk plan` reports no model: a persona model here bills its first pull at deploy

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the
default.

| Variation                 | When it is right                                                                                   | How                                                                                                                                                                                                                                                         | What it costs                                                                                                                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standing-persona-models` | You want new postings per persona flowing every month, for signals                                 | After the run, declare one `personaJobsModel(...)` per confirmed persona in `infra/models/persona-jobs.ts` from the entry in `scripts/collect/personas.ts`, add the models folder, add a monthly `schedule`, deploy. `references/persona-pulls.md` has the steps | The first run at deploy re-bills the postings the run already read. After that the extractor is incremental and only new postings bill. A model created some other way is not adopted by the declaration: the deploy stops on `duplicateSlug` and needs `cdk import` |
| `no-persona-pull`         | No TheirStack connection and no appetite for one                                                   | Delete `infra/connectors/theirstack.ts` and step 5's pull from `context-seeding.prompt.ts`; the personas are written from the careers pages                                                                                                                | Pains, KPIs and responsibility language come from postings, not from titles. The persona files carry `[I]` where the postings would have put `[R]`, and the messaging built on them is weaker for it                                                       |
| `deeper-crawl`            | You want objections and alternatives from what buyers say in public, not only what the site says   | Add review sites and communities to step 2's crawl list in `context-seeding.prompt.ts`, landing in `objection/` and `alternative/`                                                                                                                         | Public complaints are one source, often one reviewer. Everything from them stays `hypothesis`, and the objection files will read as authoritative to an agent that does not check the tag                                                                  |
| `two-stops-into-one`      | The operator is not available twice and accepts the drafted personas as they are                   | Merge step 6's questions into step 4 in `context-seeding.prompt.ts`                                                                                                                                                                                       | The persona merge/split question is answered before the postings were read, so it is answered about candidates, not drafts. Expect one round of corrections on the pull request instead                                                                    |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The public surface is the only source.** (`context-seeding.prompt.ts`) No CRM, no calls, no
  inbox, no Slack, and no mention of them to the agent. Each is another cookbook's evidence; wire
  one in here and this agent stops being the thing that runs at setup with nothing connected, and
  starts mixing a hypothesis with a verification nobody can tell apart afterwards.
- **The one-PR write path.** (`infra/agents/context-seeding.ts`) The agent never writes the
  workspace context directly and has no `context` capability: the repository is the source and
  `cargo-ai cdk deploy` syncs it. Give it `cargo-ai context runtime write` and the knowledge layer
  has two sources of truth; the next deploy overwrites whichever one a human did not see.
- **The agent does not pull; the script does.** (`scripts/collect/jobs.ts`) A fetch loop an agent
  re-derives is a fetch loop that silently changes shape, and the pull is the one spend in this
  run. The budget is read and computed, never estimated, and `--over-budget` is the operator's
  word.
- **Size is filtered at pull time through `companyFields`, never after.** (`scripts/collect/personas.ts`,
  `infra/models/persona-jobs.ts`) Billing is per returned posting. Filter after the pull and every
  row outside the band was paid for and thrown away.
- **Derive before you ask, and the three-line confirmation stays three lines.**
  (`context-seeding.prompt.ts`) More than about four questions at one stop means a lookup was
  skipped. In setup mode the questions move to the pull request; they never disappear.
- **Personas ship with detection lists or are not done.** (`context-seeding.prompt.ts`) A persona
  file without a title include and exclude list cannot be used by any classifier, scorer or router.
- **Persona files are product-free except one final derived section.** (`context-seeding.prompt.ts`)
  Everything above "How we land" describes the job, not what is sold to it.
- **Everything is a hypothesis, and the tags say so.** (`context-seeding.prompt.ts`) `[R]` only
  for what a page states, with the URL; `confidence: hypothesis` everywhere; missing evidence is
  never contradicting evidence. Drop the tags and the cookbook that later verifies against the CRM
  cannot tell what it is correcting.
- **Idempotent: seeded domains are skipped, and the skip list is printed first.**
  (`context-seeding.prompt.ts`) A domain with two or more entries is left alone entirely. Drop the
  rule and a re-run overwrites the ICP a human refined.
- **No persona model deploys by default.** (`infra/models/persona-jobs.ts`) A model runs at
  creation and bills `limit` postings before anyone confirmed the persona.
- **`scripts/context-seeding/package.json` stays.** (`scripts/package.json`) The CDK loader
  imports every `.ts` under the project root except directories carrying one; delete it and
  `cargo-ai cdk plan` calls TheirStack on every plan.
- **The harness root stays the repository root.** (`infra/agents/context-seeding.ts`) That is
  where `node_modules` is, so it is the only place `npx tsx …/collect/jobs.ts` resolves.
  `cargo-ai cdk check` prints the resolved binding; a line ending `in infra/` means the collector
  cannot run.

## Done when

- `npx tsx scripts/context-seeding/collect/jobs.ts --dry-run` printed a per-persona limit and the
  reason, read from the workspace, and nothing in this folder states a credit amount
- `cargo-ai cdk check` prints the agent bound to the repository root, and `cargo-ai cdk plan`
  reports one agent, three bound connectors, one folder and no model
- from a fresh project, one run in chat mode opened one pull request touching `global/`, `icp/`,
  `persona/`, `jtbd/`, `alternative/`, `client/`, `proof/` and `signal/`, every factual sentence
  tagged, and the operator was asked at most the questions in the table, at two stops
- one run in setup mode opened the same pull request with a "Questions for the reviewer" section
  and asked nothing
- `icp/` names a disqualifier and says which cookbook verifies it
- every persona file has a title include list, a title exclude list and a buying roles section,
  and nothing above "How we land" names the product
- every `client/` and `proof/` file carries `reference_permission`
- the pull request body states files per domain, tag counts (receipted, inferred, unknown), the
  credit spend per persona pull, and the questions asked with their answers
- re-running against the merged result prints every seeded domain on the skip list and opens no
  pull request
- after merging and `cargo-ai cdk deploy`, a seeded `context/` file is readable from the workspace
  context repository and an agent with the `context` capability quotes it back with its tag

## What it costs

The crawl is the harness's own fetches. The persona pull is the one deliberate spend and it is per
returned posting: `scripts/context-seeding/collect/jobs.ts` reads the price and the balance at run
time and prints what each pull will cost before it runs, and a TheirStack connection carrying its
own key bills TheirStack's plan rather than Cargo credits. Three to five personas at the default
per-persona limit is the whole run. The recurring cost is nothing: it runs once, and again by hand
when the site changes.

## Composes into

`crm-context` (verifies the seeded ICP and personas against won and lost deals, and proposes the
corrections), `account-scoring` (reads the `icp/` this writes, disqualifier included),
`monitor-buying-signals` and `tam-building` (the `signal/` candidates and the ICP band), and any
agent with the `context` capability.
