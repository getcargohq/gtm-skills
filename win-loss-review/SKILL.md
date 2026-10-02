---
name: win-loss-review
description: 'Every month the CRM''s closed deals are audited and what they say lands in context/ as one pull request: the ICP verified against won versus lost with a disqualifier, dated insights with counts and denominators, objections from recorded lost reasons, and a client file per closed-won account; a five-line Slack digest says what changed. Never edits a persona, nor the ICP after the first pass. Triggers: "verify our ICP against won and lost deals", "what do closed-lost deals say about who we should not sell to", "keep the context repo current from the CRM every month", "our lost reasons should become objections", "run a monthly win-loss review". Cargo CDK, harness claudeCode, HubSpot, Salesforce, Attio, Slack. Skip when: there is no CRM yet and the context should come from the website, which is web-capture; or you want one account researched before a call, which is research-account.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli 1.0.89 or later with @cargo-ai/cdk 1.0.67 or later, a Cargo workspace, an authenticated Anthropic connector (the harness runs against Cargo's proxy), an authorized GitHub connector, an authorized Slack connector, an authorized CRM connection (HubSpot in the checked example; Salesforce and Attio adapt one file), and a GTM repository with `context/` and `cadence/` at its root (the shape `cargo-ai cdk init` scaffolds). Nothing here needs a credential in .env, and nothing here reads calls, postings or the website."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/win-loss-review
metadata:
  author: getcargo
  source: cookbook
  personas:
    - revops
    - sales-leadership
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

# Win-loss review

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

What the CRM knows about who buys and who does not stops living in a report nobody reopens. Once
a month one agent runs, and three things land in your repository:

1. **The audit snapshot.** A committed script reads the last twelve months of closed deals, the
   accounts behind them and the contacts on the won ones, and writes one JSON under
   `cadence/log/raw/crm/`: pipelines, won and lost counts, the lost-reason fill rate, the
   deal-to-contact association rate, stakeholders per deal, the titles on won deals, and which
   deals are new since the previous snapshot.
2. **The context files.** On the first pass the agent verifies `icp/` against what separates won
   from lost and names a disqualifier; it writes dated `insight/` files in three buckets (who we
   talk to, where we win, where we lose), every count with its denominator; `objection/` files
   from lost reasons where the CRM records them; and a `client/` file per closed-won account. Every
   month after, it appends what the new deals say and edits nothing that exists.
3. **The digest.** Five lines in Slack: deals closed, won and lost with the two hygiene rates,
   three things learned, one proposed change if any, the pull request link.

Then it opens one pull request and stops. A human merges, and the next `cargo-ai cdk deploy`
syncs `context/` into the workspace context repository, which is where every other Cargo agent
reads before it acts.

The CRM is its only source, and the confidence follows the data. With twenty or more closed-won
deals in the window the run is in **verify mode** and states what won versus lost shows with
conviction. Below that it is in **hypothesis mode**: the same files, every finding carrying its
denominator and `confidence: hypothesis`, and the pull request says how many wins would make it an
analysis. Two hygiene findings open every pull request, stated plainly and never worked around:
the lost-reason fill rate, which decides whether objections can come from the CRM at all, and the
deal-to-contact association rate, which says how many closed deals are blind for stakeholder
mapping.

This is a quarterly win-loss review turned into one declared resource, one collector script and
one pull-request write path. `harness: "claudeCode"` is what buys the working tree: the output of
a month is a diff across markdown files, and only an agent with a checkout can produce one.

Three properties make it safe enough to run unattended:

- **The collection is deterministic.** The agent does not read the CRM. `scripts/collect/crm.ts`
  does, the same way every month, and the agent is told not to improvise that step. Reads only:
  it bills no credits and writes nothing to the CRM.
- **The pull request is the gate.** The agent has repository write access and `postMessage` to one
  locked channel. It cannot write the workspace context directly, cannot touch the CRM, cannot
  email anyone, and cannot merge itself.
- **Personas are never edited, and the ICP only on the first pass.** They are what the scorer and
  every outbound agent key on. A change the deals suggest is a proposal in the pull request body,
  with the deal ids, and a human decides.

## Example

> Every month, read what our HubSpot won and lost deals say, verify the ICP, and post the digest to #gtm-context.

Illustrative output, fictional records:

```text
:bar_chart: *Win-loss review Oct 2026*: 23 deals closed
Won 9, lost 14 · lost reason on 11 of 14 · contacts on 19 of 23
Learned: 6 of 9 wins had a RevOps title on the deal · 8 of 14 losses were under 50 employees · "no budget this quarter" on 5 of 11 reasons
Proposed: add "under 50 employees" as an ICP disqualifier (8 of 14 losses, 0 of 9 wins), in the PR body
PR: https://github.com/northwind/gtm/pull/331
```

The pull request adds four dated `insight/` files, two `objection/` files and nine `client/` files,
and modifies nothing under `icp/` or `persona/`; the disqualifier waits for a human.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it: the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/win-loss-review` writes the resources to `infra/win-loss-review/`, the
   collector to `scripts/win-loss-review/`, and this procedure to `.claude/skills/win-loss-review/`. No project yet?
   `cargo-ai cdk init <dir> --cookbook win-loss-review && cd <dir> && npm install` does both; this
   folder never ships a shell. **If you are reading this from the project's `.claude/skills/`, the
   install already happened: start at step 2.** On a CLI too old to have `add`, copy this folder
   in as a sibling of what is there by hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** If the project already has a GitHub, Slack or
   Anthropic connector or an agents folder, rewire the imports to the existing one and drop the
   copy; two resources with one slug is a collision at deploy. This folder declares no CRM
   connector: the audit resolves the CRM at run time from the workspace's connections, so a project
   whose other cookbooks already bind one needs nothing rewired. The knowledge layer needs no work:
   the scaffold already declares the repo's root `context/` in `infra/context.ts`, and
   `defineContext` is a per-workspace singleton, which is why this folder ships none. **Append
   nothing to `.env.example`:** nothing here holds a credential.
3. **Run the audit by hand once.** From the repository root,
   `npx tsx scripts/win-loss-review/collect/crm.ts --dry-run` prints the closed, won and lost counts in
   the window, the pipelines it found and the mode. Read it: a `hypothesis` on a workspace you
   know has the deals means the wrong CRM connection was picked or the window is wrong, and more
   than one pipeline means `PIPELINES` in `scripts/win-loss-review/collect/config.ts` wants pinning.
   Then drop `--dry-run` and confirm `cadence/log/raw/crm/<today>.json` carries real deal names.
   Set `LOST_REASON_PROPERTY` in the same file when the fill rate reads 0 of N: that is a custom
   property, not a team that never records reasons.
4. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted (nobody asks for a variant they do not know exists); _What you will be asked_ is
   the floor, and you derive before you ask. If you are asking more than about four questions you
   have skipped lookups. Set the Slack channel id and the model. Record what you changed and why
   under a `## Decisions` section in your copy of this file.
5. **Plan, then stop.** `node --import tsx evals/contract.mjs` from this skill's folder, then
   `npm run check && cargo-ai cdk plan` from the project root (`check` validates the resource tree
   offline; the blank template ships it). Show the diff: one agent, three bound connectors, one
   folder, and no model. Deploy only on an explicit yes: `cargo-ai cdk deploy`. Never
   `cdk init --force` into a non-empty directory.
6. **Run the first pass by hand.** From the workspace UI or with
   `cargo-ai ai message create --agent-uuid <uuid> --parts '[{"type":"text","text":"Run the win-loss review first pass. Follow your system prompt exactly and open one pull request."}]'`.
   It states the hygiene findings and the mode, reads the whole window, and opens the pull request.
   The cron takes it from there.
7. **Verify.** Walk _Done when_ line by line and report each with evidence. Deployed cleanly and
   produced nothing is the normal failure, and the second normal failure is a pull request of
   fifty files nobody reads: check the hygiene findings and the tag counts in its body before you
   call this done.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the rows marked
_asked_ genuinely live in the operator's head; the agent runs on a cron, so it asks in the pull
request body, never in a chat.

| Input                                                     | Kind      | How it is answered                                                                                                                                                                                                                                                                            | Why it matters                                                                                                                                                                                                               |
| --------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRM connection (`CRM` in `scripts/collect/config.ts`)     | value     | **derived**: `auto` takes the workspace's default HubSpot, Salesforce or Attio connection from `cargo-ai connection connector list`. **asked** only when the workspace holds two: pin the slug.                                                                                               | The audit reads one CRM. Two connections and `auto` reads the default and says which; the wrong one is a clean audit of the wrong deals.                                                                                     |
| pipelines (`PIPELINES`)                                   | value     | **derived** by the audit: every pipeline is read and listed with its counts. **asked** in the first pull request only when there is more than one: which are the sales pipelines. The window is always the last twelve months (`WINDOW_DAYS`).                                                | Partner, renewal and support pipelines close deals too, and they are not the same evidence. One pipeline needs no question; two need exactly one.                                                                            |
| CRM hygiene findings                                      | value     | **derived** by the audit and **stated**, never asked and never worked around: lost reason filled on n of N lost deals; contacts on n of N closed deals. They open every pull request and the digest's second line.                                                                            | The first decides whether objections can come from the CRM at all. The second says how many closed deals are blind for stakeholder mapping, so every title count is read against the right denominator.                      |
| lost-reason property (`LOST_REASON_PROPERTY`)             | value     | **derived**: HubSpot's standard `closed_lost_reason` ships. A fill rate of 0 of N with lost deals in the window is the cue to find the custom property in the CRM's schema and set it; the audit never guesses one.                                                                           | Most portals record the reason on a custom property. Left wrong, the audit reports a team that never records reasons, and writes no objections, forever.                                                                     |
| mode                                                      | value     | **derived** by the audit: `verify` at 20 or more closed-won deals in the window (`VERIFY_MIN_WON`), else `hypothesis`. Never asked.                                                                                                                                                           | Verify mode states what won versus lost shows with conviction; hypothesis mode marks every finding with its denominator and says how many wins would make it an analysis. The line is a number so nobody argues it per run.  |
| `icp/`                                                    | generated | **derived**: what separates won from lost across industry, size, geography and what the records hold about stack, with at least one disqualifier. A seeded ICP gets one dated "Verified against the CRM" section on the first pass; an empty `icp/` gets the file. Never edited after that.   | The disqualifier is the half of an ICP that protects the team's time, and won versus lost is the only place it comes from with evidence.                                                                                     |
| `insight/`, `objection/`, `client/`                       | generated | **derived** from the snapshot: three insight buckets with counts and denominators; objections only when the fill rate is at least half and a reason recurs on two or more deals; one client file per closed-won account, no amount, `reference_permission: unknown`.                          | Insights are what next month is diffed against; without dates and denominators the run cannot tell change from guess. Amounts stay in the CRM: `context/` is read by every agent, including the ones that talk to prospects. |
| persona reconciliation                                    | generated | **derived**: every title on a won deal is mapped to the `persona/` file that detects it, or listed as undetected with its count, in the "who we talk to" insight. A change to a persona is **proposed** in the pull request body, never applied.                                              | The personas are what the scorer and every outbound agent key on. The evidence to change them comes from here; the decision does not.                                                                                        |
| Slack channel (`infra/agents/win-loss-analyst.ts`)        | value     | **asked**: the channel the digest lands in, locked on the `postMessage` use. An id (`C…`), not a name.                                                                                                                                                                                        | Locked so the agent cannot pick a customer shared channel; a digest about lost deals is internal.                                                                                                                            |
| repository binding (`infra/agents/win-loss-analyst.ts`)   | value     | **derived**: leave `repository`, `defaultBranch` and `connector` unset and `plan` fills them from the git origin of the checkout, taking the GitHub connector from the project's own. `cargo-ai cdk check` prints what it resolved: confirm the line reads your repo and the repository root. | This is the working tree the harness clones and the only place its output can land. A binding rooted at `infra/` has no node_modules, so the audit cannot run.                                                               |
| LLM connector and model (`infra/connectors/anthropic.ts`) | value     | **derived**: `cargo-ai connection connector list` shows whether an Anthropic connector is authorized; if not, `cargo-ai cdk add connector/anthropic` takes the key. Any Anthropic model pairs with `claudeCode`; the agent's `languageModel` is a placeholder to set.                         | A harness does not bring its own model; this is what the monthly run is billed and metered against. Pair `claudeCode` with an `openAi` connector and it typechecks green and fails at deploy.                                |

Checked before moving on, not after the deploy:

- the audit ran by hand once and wrote a real JSON with real deal names
- the two hygiene findings in that JSON are numbers you can say out loud with their denominators
- `cargo-ai cdk check` prints the agent bound to the repository root, not `infra/`
- exactly one `defineContext` in the project, the scaffold's, resolving to the root `context/`
- the Slack channel id is an id, not a name, and not a customer shared channel
- `PIPELINES` is pinned, or the snapshot lists exactly one pipeline

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the
default.

| Variation               | When it is right                                                                         | How                                                                                                                                                                          | What it costs                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `another-crm`           | The deals live in Salesforce or Attio                                                    | Write `scripts/collect/crms/<slug>.ts` satisfying `Crm` and register it in `crms/index.ts`; set `CRM` in `config.ts`. `references/crm-audit.md` names the objects and fields | Written from API docs until it has run against a live workspace, and the audit says so on every run. Check `--dry-run` reports real counts before trusting a snapshot               |
| `raise-the-verify-line` | Twenty wins is too few to separate won from lost in your market (long cycles, few deals) | Raise `VERIFY_MIN_WON` in `scripts/win-loss-review/collect/config.ts`                                                                                                        | More months land in hypothesis mode, and the ICP section stays tagged with denominators until the CRM catches up. The operator approves more and the files assert less              |
| `wider-window`          | Your sales cycle is longer than a year, or last year was not representative              | Raise `WINDOW_DAYS` in the same file                                                                                                                                         | Older deals describe an older market. The insight dates say so, but the ICP section does not, and a two-year window on a company that repositioned last spring verifies the old ICP |
| `quarterly`             | Fewer than ten deals close a month and the digest is mostly "nothing new"                | Change the cron in `infra/agents/win-loss-analyst.ts` to the first of every third month                                                                                      | A lost reason that recurs in month one is written in month three. The append-only rule means nothing is lost, only late                                                             |
| `no-digest`             | The team reads pull requests and does not want a Slack post                              | Delete `infra/connectors/slack.ts`, the `uses` block on the agent and step 8 of the prompt                                                                                   | The pull request is the only surface, and a monthly pull request nobody is pinged about is a monthly pull request nobody opens                                                      |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The CRM is the only source.** (`win-loss-analyst.prompt.ts`) No calls, no postings, no website, no
  inbox, and no mention of them to the agent. Each is another cookbook's evidence; wire one in
  here and a verification gets mixed with a hypothesis nobody can tell apart afterwards.
- **The agent does not read the CRM; the script does.** (`scripts/collect/crm.ts`) A fetch loop an
  agent re-derives each month is a fetch loop that silently changes shape: a window that drifts,
  a pipeline that quietly joins. The snapshot is what every later run is diffed against, so its
  rules have to be identical every run.
- **The one-PR write path.** (`infra/agents/win-loss-analyst.ts`) The agent never writes the workspace
  context directly and has no `context` capability: the repository is the source and
  `cargo-ai cdk deploy` syncs it.
- **Personas are never edited, and the ICP only on the first pass, append-only.**
  (`win-loss-analyst.prompt.ts`) They are what the scorer and every outbound agent key on. A monthly
  agent quietly rewriting them is how a knowledge base drifts without anyone deciding it should;
  a proposal in the pull request body with deal ids is how it changes on purpose.
- **The hygiene findings are stated, never worked around.** (`win-loss-analyst.prompt.ts`) A fill rate
  under half means no objections from the CRM this month, said out loud. Let the agent infer
  reasons from deal names and the objection files become fiction with a receipt tag.
- **Every count carries its denominator.** (`scripts/collect/audit.ts`, `win-loss-analyst.prompt.ts`)
  "6 of 9 wins", never "67%". Next month's run cannot tell change from guess otherwise, and a
  reader cannot tell a pattern from two deals.
- **No amounts and no people in `context/`.** (`scripts/collect/audit.ts`, `win-loss-analyst.prompt.ts`)
  The snapshot carries titles and ids, never emails; the agent writes no deal amount. `context/`
  is read by every agent, including the ones that talk to prospects.
- **The channel is locked on the `postMessage` use.** (`infra/agents/win-loss-analyst.ts`) A digest
  about lost deals in a customer shared channel is the one failure nobody can undo.
- **`scripts/win-loss-review/package.json` stays.** (`scripts/package.json`) The CDK loader imports
  every `.ts` under the project root except directories carrying one; delete it and
  `cargo-ai cdk plan` runs the audit against the live CRM on every plan.
- **The harness root stays the repository root.** (`infra/agents/win-loss-analyst.ts`) That is where
  `node_modules` is, so it is the only place `npx tsx …/collect/crm.ts` resolves, and where
  `context/` and `cadence/` live. A line ending `in infra/` in `cargo-ai cdk check` means the
  audit cannot run and the month reports clean and empty.

## Done when

- `npx tsx scripts/win-loss-review/collect/crm.ts --dry-run` printed real counts and the mode, and the
  run without it wrote `cadence/log/raw/crm/<today>.json` with real deal names, a lost-reason fill
  rate, an association rate and titles on won deals, with no email or amount in the file
- `cargo-ai cdk check` prints the agent bound to the repository root, and `cargo-ai cdk plan`
  reports one agent, three bound connectors, one folder and no model
- the first pass opened one pull request whose body opens with the two hygiene findings with
  denominators, then the mode and the won count that set it
- `icp/` carries a disqualifier derived from won versus lost, citing the snapshot, as a new file or
  as one dated section appended to the seeded one
- `insight/` holds dated files in the three buckets with counts and denominators, and every title
  on a won deal is mapped to a persona or listed as undetected
- with the fill rate under half, no `objection/` file exists and the body says why; at or above it,
  every objection cites two or more deals by id
- every `client/` file carries `reference_permission: unknown` and no amount
- nothing under `persona/` changed, and any proposed change is in the pull request body with deal
  ids
- the Slack digest is five lines, its numbers match the snapshot, and the last line is the pull
  request link
- a monthly run against a project with new deals opened a pull request that adds files and
  modifies none under `icp/` or `persona/`; with no new deals it opened none and the digest said so
- after merging and `cargo-ai cdk deploy`, the verified ICP section is readable from the workspace
  context repository and an agent with the `context` capability quotes it back with its tag

## What it costs

The audit is free: `searchRecords` on the CRM bills no credits, and it is a few hundred reads at
most, paced, once a month. The recurring cost is one harness run a month, scaling with how many
deals closed since the previous one, plus the first pass over the whole window.

## Composes into

`web-capture` (this verifies the ICP it seeds from the website and proposes the corrections),
`account-scoring` (reads the verified `icp/`, disqualifier included), `crm-enrichment` (the
association rate this reports is what a contact enrichment raises), and any agent with the
`context` capability.
