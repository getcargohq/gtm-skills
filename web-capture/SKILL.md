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

1. **The snapshot.** A committed script reads the company's own pages (home, pricing, customers,
   careers, blog, changelog) and asks one news question for the days since the last snapshot. It
   writes one JSON under `cadence/log/raw/web/` with every page's text, the news items with their
   URLs, and what changed since the previous snapshot.
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

Three properties make it safe enough to run unattended:

- **The collection is deterministic.** The agent does not crawl or search.
  `scripts/collect/web.ts` does, the same way every week, and a page's hash is what says it
  changed. The news window runs from the last committed snapshot, so a quiet week is covered by the
  next run rather than skipped.
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
one news search billed.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it: the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/web-capture` writes the resources to `infra/web-capture/`, the
   collector to `scripts/web-capture/`, and this procedure to `.claude/skills/web-capture/`. No
   project yet? `cargo-ai cdk init <dir> --cookbook web-capture && cd <dir> && npm install` does
   both; this folder never ships a shell. **If you are reading this from the project's
   `.claude/skills/`, the install already happened: start at step 2.** On a CLI too old to have
   `add`, copy this folder in as a sibling of what is there by hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** If the project already has a GitHub or
   Anthropic connector or an agents folder, rewire the imports to the existing one and drop the
   copy; two resources with one slug is a collision at deploy. The knowledge layer needs no work:
   the scaffold already declares the repo's root `context/` in `infra/context.ts`, and
   `defineContext` is a per-workspace singleton, which is why this folder ships none. **Append
   nothing to `.env.example`:** nothing here holds a credential.
3. **Set the domain and the pages.** In `scripts/web-capture/collect/config.ts`, set `DOMAIN` to the
   company's own domain and `PAGES` to the site's real sections (the sitemap lists them). Then,
   from the repository root, `npx tsx scripts/web-capture/collect/web.ts --dry-run` prints the
   domain, the pages, the news window and what the run bills.
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
   The first run always opens a pull request: its snapshot is the baseline every later week is
   diffed against, and it only counts once it is merged. The Monday cron takes it from there.
7. **Verify.** Walk _Done when_ line by line and report each with evidence.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the rows marked
_asked_ genuinely live in the operator's head.

| Input                                                     | Kind  | How it is answered                                                                                                                                                       | Why it matters                                                                                                                     |
| --------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| domain (`DOMAIN` in `scripts/collect/config.ts`)          | value | **derived** from the workspace name, `context/global/` or the repository README. **asked** only when none of them names one                                              | Every file the agent writes is about this company; a wrong domain is a wrong knowledge base. The collector refuses the placeholder |
| pages (`PAGES`)                                           | value | **derived** from the site's sitemap: the sections that say what is sold, to whom, at what price, for which customers, and what shipped                                   | A page not listed is a change never seen. A listed page that answers 404 is recorded as missing, not as an error                   |
| LLM connector and model (`infra/connectors/anthropic.ts`) | value | **derived**: `cargo-ai connection connector list` shows whether an Anthropic connector is authorized; the agent's `languageModel` is a placeholder to set                | A harness does not bring its own model; this is what the weekly run is billed and metered against                                  |
| repository binding (`infra/agents/web-scribe.ts`)         | value | **derived**: leave `repository` unset and `plan` fills it from the git origin of the checkout. `cargo-ai cdk check` prints what it resolved: confirm the repository root | A binding rooted at `infra/` has no node_modules, so the collector cannot run and the week reports nothing                         |

Checked before moving on, not after the deploy:

- the dry run printed the company's own domain and the pages you meant
- `cargo-ai cdk check` prints the agent bound to the repository root, not `infra/`
- exactly one `defineContext` in the project, the scaffold's, resolving to the root `context/`

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the
default.

| Variation      | When it is right                                                           | How                                                                                                                 | What it costs                                                                                                       |
| -------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `more_pages`   | Product, solution or docs pages say what is sold better than the home page | Add their paths to `PAGES` in `scripts/collect/config.ts`                                                           | More text per snapshot and more candidate changes for the agent to read; each JavaScript-only page bills an extract |
| `daily`        | The company ships or gets covered several times a week                     | Change the cron in `infra/agents/web-scribe.ts`                                                                     | Five times the runs, and most days open no pull request                                                             |
| `slack_digest` | The team does not watch pull requests                                      | Add a Slack connector and a locked `postMessage` use on the agent, as standup does, and a digest step to the prompt | One more connector to keep authorized, and a channel to choose                                                      |
| `deeper_news`  | The `lite` search misses coverage the team knows about                     | Set `NEWS_PROCESSOR` to `base` in `scripts/collect/config.ts`                                                       | The next rung of the processor price ladder on every run; read it live before switching                             |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The web is the only source.** (`web-scribe.prompt.ts`) No CRM, no calls, no inbox, no Slack.
  Each is another cookbook's evidence; mix one in here and a page and a deal end up in one file at
  one confidence nobody can tell apart afterwards.
- **The agent does not crawl or search; the script does.** (`scripts/collect/web.ts`) A fetch loop
  an agent re-derives each week silently changes shape, and the snapshot is what next week is
  diffed against.
- **Existing files are never edited.** (`web-scribe.prompt.ts`) What a human corrected stays
  corrected. A change to an existing file is a proposal in the pull request body.
- **The one-PR write path.** (`infra/agents/web-scribe.ts`) The agent never writes the workspace
  context directly and has no `context` capability: the repository is the source and
  `cargo-ai cdk deploy` syncs it.
- **The first run always opens a pull request.** (`web-scribe.prompt.ts`) Its snapshot is the
  baseline. Without it committed, every run reads as a first run and nothing is ever a change.
- **Every claim is tagged.** (`web-scribe.prompt.ts`) `[R]`, `[I]` or `[TR]`, and missing evidence
  is never contradicting evidence.
- **`scripts/web-capture/package.json` stays.** (`scripts/package.json`) The CDK loader imports
  every `.ts` under the project root except directories carrying one; delete it and
  `cargo-ai cdk plan` runs the news search on every plan.

## Done when

- `npx tsx scripts/web-capture/collect/web.ts --dry-run` printed the company's own domain, the
  pages and the news window
- `cargo-ai cdk check` prints the agent bound to the repository root, and `cargo-ai cdk plan`
  reports one agent, two bound connectors, one folder and no model
- the first run opened one pull request with the baseline snapshot, seeded every empty domain, and
  edited no existing file
- every seeded file carries tags, `icp/` names a disqualifier, and every `client/` file carries
  `reference_permission: unknown`
- after the baseline was merged, a run with a change opened a pull request adding
  `insight/<date>-web.md` with one tagged line per finding, and proposed rather than made any edit
  to an existing file
- a run with nothing worth writing opened no pull request and printed the collector's counts
- after merging and `cargo-ai cdk deploy`, a seeded file is readable from the workspace context
  repository and an agent with the `context` capability quotes it back with its tag

## What it costs

Fetch live prices before every estimate: `cargo-ai connection integration get parallel`, plus the
LLM connector's model. Quote the lookup time with the estimate.

Pages are fetched like any visitor reads them, for nothing. The news is one `parallel.createTask` on
the `lite` processor a run, the cheapest rung of its price ladder. A page that comes back as an empty
JavaScript shell is read again through `parallel.extract`, billed per URL. A normal week is the one
news task plus the harness run, which scales with how much changed.

## Composes into

`win-loss-review` (verifies the ICP this seeds against won and lost deals, and proposes the
corrections), `call-capture` (adds what buyers say on calls), `account-scoring` (reads the ICP),
and any agent with the `context` capability.
