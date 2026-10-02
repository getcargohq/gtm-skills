---
name: web-capture
description: 'Each Monday the company''s own website and recent news about it land in context/ as one pull request: the first run seeds positioning, offerings, an inferred ICP with a disqualifier, competitors, clients and proof from the public pages; every run after adds a dated note of what changed (an offering, pricing, a launch, funding, a customer) and never edits an existing file. Triggers: "keep our context current from our website", "what changed on our website lately", "add our company news to the knowledge base", "our context repo is empty, seed it from our website", "set up the workspace context from our domain". Cargo CDK, harness claudeCode, parallel, GitHub. Skip when: news about target accounts, which is monitor-buying-signals; one company researched before a call, which is research-account; or the ICP verified against won and lost deals, which is win-loss-review.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli 1.0.89 or later with @cargo-ai/cdk 1.0.67 or later, a Cargo workspace, an authenticated Anthropic connector (the harness runs against Cargo's proxy), an authorized GitHub connector, and a GTM repository with `context/` and `cadence/` at its root (the shape `cargo-ai cdk init` scaffolds). Nothing here needs a credential in .env, and nothing here reads a CRM, a call or Slack."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/web-capture
metadata:
  author: getcargo
  source: cookbook
  personas:
    - gtm-engineering
    - revops
    - marketing
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

# Web capture

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

What the company says about itself on the web, and what the web says about it, stops drifting away
from what every agent reads. Once a week one agent runs, and lands it in your repository:

1. **The raw reads.** The agent reads the company's own pages (home, pricing, customers, careers,
   blog, changelog) in one `parallel.extract` call and writes each page's text, verbatim, to a
   fixed file under `cadence/log/raw/web/pages/`. It asks one news question for the days since the
   last merged read and writes the items to `cadence/log/raw/web/news/<date>.json`. `git diff`
   against the default branch is what says a page changed.
2. **The context files.** The first run seeds every empty domain: `global/` (positioning, value
   proposition, offerings), `icp/` as an inferred profile with at least one disqualifier,
   `alternative/`, `client/`, `proof/` and `signal/` candidates. Every run after adds one dated
   `insight/<date>-web.md` with what changed that week, plus a `client/` or `alternative/` file for
   a newly named customer or competitor. It never edits a file that exists: a change to one is a
   proposal in the pull request body.

Then it opens one pull request and stops. A human merges, and the next `cargo-ai cdk deploy` syncs
`context/` into the workspace context repository, which is where every other Cargo agent reads
before it acts. A week with nothing worth writing opens no pull request.

Every factual sentence carries an evidence tag: `[R: <url>]` receipted by a page, `[I: <from
what>]` inferred, `[TR: <what would settle it>]` unknown. Public pages are one source, so nothing
here is stated with the conviction of a deal; `win-loss-review` is what later verifies the ICP
against won and lost.

The whole cookbook is one agent and its prompt. There is no collector script: the prompt spells out
the two exact `cargo-ai` commands, so every week reads the web the same way, and git does the
diffing. Three properties make it safe enough to run unattended:

- **The reads are fixed.** The same two commands every week, and the page text written verbatim,
  so a diff is a change on the site, not a change in how the agent felt about it. The news window
  starts at the last merged read, so a quiet week is covered by the next run rather than skipped.
- **The pull request is the gate.** The agent has repository write access and nothing else: no
  workspace context write, no CRM, no email, no Slack, no merge.
- **Append-only after the first run.** Existing files are never edited, so what a human corrected
  stays corrected.

## Example

> Every Monday, read our website and the news about us, and keep context/ current.

Illustrative output, fictional records:

```text
insight/2026-10-05-web.md
- New offering on /pricing: "Enterprise" tier with SSO and audit logs [R: https://northwind.example/pricing]
- Launched a HubSpot integration on 2026-09-30 [R: https://northwind.example/changelog]
- Raised a $20M Series B led by Contoso Ventures, 2026-10-01 [R: https://news.example/northwind-series-b]
- Fabrikam named as a customer, 40% faster onboarding [R: https://northwind.example/customers/fabrikam]

client/fabrikam.md, proof/fabrikam-onboarding.md   (reference_permission: unknown)
PR body: proposes adding "Enterprise" to global/offerings.md; one file edit proposed, none made
```

A week after the first run: one pull request, four findings, two new files, one proposed edit, and
two reads billed (the pages and the news).

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it: the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/web-capture` writes the resources to `infra/web-capture/` and this
   procedure to `.claude/skills/web-capture/`. No project yet?
   `cargo-ai cdk init <dir> --cookbook web-capture && cd <dir> && npm install` does both; this
   folder never ships a shell. **If you are reading this from the project's `.claude/skills/`, the
   install already happened: start at step 2.** On a CLI too old to have `add`, copy this folder in
   as a sibling of what is there by hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** If the project already has a GitHub or
   Anthropic connector or an agents folder, rewire the imports to the existing one and drop the
   copy; two resources with one slug is a collision at deploy. The knowledge layer needs no work:
   the scaffold already declares the repo's root `context/` in `infra/context.ts`, and
   `defineContext` is a per-workspace singleton, which is why this folder ships none. **Append
   nothing to `.env.example`:** nothing here holds a credential.
3. **Set the domain and the pages.** In `infra/agents/web-scribe.prompt.ts` (at
   `infra/web-capture/agents/web-scribe.prompt.ts` once installed), set `DOMAIN` to the company's own domain and
   `PAGES` to the site's real sections; the sitemap lists them. The agent refuses to run on the
   placeholder domain.
4. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted; _What you will be asked_ is the floor, and you derive before you ask. Set the
   model. Record what you changed and why under a `## Decisions` section in your copy of this file.
5. **Plan, then stop.** `node --import tsx evals/contract.mjs` from this skill's folder, then
   `npm run check && cargo-ai cdk plan` from the project root (`check` validates the resource tree
   offline; the blank template ships it). Show the diff: one agent, two bound connectors, one
   folder, and no model. Deploy only on an explicit yes: `cargo-ai cdk deploy`. Never
   `cdk init --force` into a non-empty directory.
6. **Run the first one by hand.** From the workspace UI or with
   `cargo-ai ai message create --agent-uuid <uuid> --parts '[{"type":"text","text":"Run the web capture. Follow your system prompt exactly."}]'`.
   The first run always opens a pull request: its page and news files are the baseline every later
   week is diffed against, and they only count once merged. The Monday cron takes it from there.
7. **Verify.** Walk _Done when_ line by line and report each with evidence.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the rows marked
_asked_ genuinely live in the operator's head.

| Input                                                     | Kind  | How it is answered                                                                                                                                                       | Why it matters                                                                                                                 |
| --------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| domain (`DOMAIN` in `infra/agents/web-scribe.prompt.ts`)  | value | **derived** from the workspace name, `context/global/` or the repository README. **asked** only when none of them names one                                              | Every file the agent writes is about this company; a wrong domain is a wrong knowledge base. The agent refuses the placeholder |
| pages (`PAGES`, same file)                                | value | **derived** from the site's sitemap: the sections that say what is sold, to whom, at what price, for which customers, and what shipped                                   | A page not listed is a change never seen                                                                                       |
| LLM connector and model (`infra/connectors/anthropic.ts`) | value | **derived**: `cargo-ai connection connector list` shows whether an Anthropic connector is authorized; the agent's `languageModel` is a placeholder to set                | A harness does not bring its own model; this is what the weekly run is billed and metered against                              |
| repository binding (`infra/agents/web-scribe.ts`)         | value | **derived**: leave `repository` unset and `plan` fills it from the git origin of the checkout. `cargo-ai cdk check` prints what it resolved: confirm the repository root | It is the working tree the agent diffs against the default branch, and the only place its output can land                      |

Checked before moving on, not after the deploy:

- `DOMAIN` is the company's own domain, and `PAGES` are sections that exist
- `cargo-ai cdk check` prints the agent bound to the repository root, not `infra/`
- exactly one `defineContext` in the project, the scaffold's, resolving to the root `context/`

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the
default.

| Variation      | When it is right                                                           | How                                                                                                                 | What it costs                                                                            |
| -------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `more_pages`   | Product, solution or docs pages say what is sold better than the home page | Add them to `PAGES` in `infra/agents/web-scribe.prompt.ts`                                                          | One more URL billed on every page read, and more candidate changes for the agent to read |
| `daily`        | The company ships or gets covered several times a week                     | Change the cron in `infra/agents/web-scribe.ts`                                                                     | Five times the reads, and most days open no pull request                                 |
| `slack_digest` | The team does not watch pull requests                                      | Add a Slack connector and a locked `postMessage` use on the agent, as standup does, and a digest step to the prompt | One more connector to keep authorized, and a channel to choose                           |
| `deeper_news`  | The `lite` search misses coverage the team knows about                     | Change `"processor":"lite"` to `"base"` in the news command and the line after it                                   | The next rung of the processor price ladder on every run; read it live before switching  |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The web is the only source.** (`web-scribe.prompt.ts`) No CRM, no calls, no inbox, no Slack.
  Each is another cookbook's evidence; mix one in here and a page and a deal end up in one file at
  one confidence nobody can tell apart afterwards.
- **The reads are the two commands in the prompt, and the page text is written verbatim.**
  (`web-scribe.prompt.ts`) An agent that fetches its own way, or tidies the text, makes every week
  look like a change on the site, and the diff stops meaning anything.
- **Existing files are never edited.** (`web-scribe.prompt.ts`) What a human corrected stays
  corrected. A change to an existing file is a proposal in the pull request body.
- **The one-PR write path.** (`infra/agents/web-scribe.ts`) The agent never writes the workspace
  context directly and has no `context` capability: the repository is the source and
  `cargo-ai cdk deploy` syncs it.
- **The first run always opens a pull request.** (`web-scribe.prompt.ts`) Its page and news files
  are the baseline. Until they are merged, every run reads as a first run and nothing is ever a
  change.
- **Every claim is tagged.** (`web-scribe.prompt.ts`) `[R]`, `[I]` or `[TR]`, and missing evidence
  is never contradicting evidence.

## Done when

- `DOMAIN` and `PAGES` name the company and its real sections, and the contract passes
- `cargo-ai cdk check` prints the agent bound to the repository root, and `cargo-ai cdk plan`
  reports one agent, two bound connectors, one folder and no model
- the first run opened one pull request with the page and news files, seeded every empty domain,
  and edited no existing file
- every seeded file carries tags, `icp/` names a disqualifier, and every `client/` file carries
  `reference_permission: unknown`
- after the baseline was merged, a run with a change opened a pull request adding
  `insight/<date>-web.md` with one tagged line per finding, and proposed rather than made any edit
  to an existing file
- a run with nothing worth writing opened no pull request
- after merging and `cargo-ai cdk deploy`, a seeded file is readable from the workspace context
  repository and an agent with the `context` capability quotes it back with its tag

## What it costs

Fetch live prices before every estimate: `cargo-ai connection integration get parallel`, plus the
LLM connector's model. Quote the lookup time with the estimate.

Each run bills two reads: one `parallel.extract` over the listed pages (billed per URL) and one
`parallel.createTask` on the `lite` processor, the cheapest rung of its price ladder. Plus the
harness run, which scales with how much changed.

## Composes into

`win-loss-review` (verifies the ICP this seeds against won and lost deals, and proposes the
corrections), `call-capture` (adds what buyers say on calls), `account-scoring` (reads the ICP),
and any agent with the `context` capability.
