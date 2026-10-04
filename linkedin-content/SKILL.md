---
name: linkedin-content
description: 'Every Monday three LinkedIn post drafts for one author land in the GTM repo as one pull request, built only from what context/ and the cadence log already say, each with its hook and the files it draws on; nothing is ever published. Triggers: "draft our founder''s LinkedIn posts every week", "weekly LinkedIn drafts from our proof points", "turn our wins and insights into LinkedIn posts", "keep a LinkedIn content pipeline", "ghostwrite LinkedIn posts from our context", "content calendar for the CEO on LinkedIn". Cargo CDK, defineAgent, harness claudeCode, GitHub, context/, cadence/content. Skip when: you want the company website and news read into context/, which is web-capture; or you want one post written now, in this chat, with nothing deployed.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.67 or later (the harness repository spec, rooted at the package.json that declares the CDK), a Cargo workspace, an authenticated Anthropic connector, an authorized GitHub connector, and a GTM repository with context/ and cadence/ at its root (the shape `cargo-ai cdk init` scaffolds)."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/linkedin-content
metadata:
  author: getcargo
  source: cookbook
  personas:
    - marketing
    - sales-leadership
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

# LinkedIn content

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

The proof points, customer stories and lessons the team already wrote down stop sitting in a repo
nobody outside GTM reads. Every Monday one agent reads `context/` (positioning, proof, clients,
insights, objections, alternatives) and the last two weeks of `cadence/log/`, and drafts three
LinkedIn posts for one named author:

1. **One on a proof point**: a result a customer got, from a `proof/` file.
2. **One that answers an objection** or a misconception buyers bring, without naming a competitor.
3. **One from this week**: something the team learned, from a dated insight or log entry.

Each draft opens on a hook line, stays under LinkedIn's fold-friendly length, and ends with the
files it draws on. A claim with no file behind it is cut. A customer without reference permission is
described, never named.

The drafts land as `cadence/content/<week>.md` in one pull request, `[linkedin-content] <week>`. A
re-run that week finds that pull request by its title, links it and stops; it never opens a second one. To redraft, close the pull request and run it again.
The agent has no LinkedIn action at all: publishing is the author's act, done by hand, after review.

## Example

> Every Monday, draft three LinkedIn posts for our CEO, Dana Ruiz, from what's in context/.

Illustrative output, fictional records:

```text
## 1. Proof point: routing fixed in a week

**Hook:** A 240-person freight-audit company stopped losing one inbound lead in six.

Their routing broke every time someone renamed a CRM field. Nobody noticed
until a quarter's pipeline review. We moved the rules into code with a test
on every field they read, and the leak closed in the first week...

**Sources:** context/proof/fabrikam-routing-leak.md, context/client/fabrikam.md

## 2. Objection: "we already have a CRM admin"

**Hook:** Your CRM admin is not the problem. The spreadsheet next to them is.
...
**Sources:** context/objection/already-have-admin.md, context/insight/2026-10-01-win-loss.md
```

Three drafts and six cited files landed in the "[linkedin-content] 2026-W41" pull request; nothing
was posted anywhere.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it — the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/linkedin-content` writes this example to `infra/linkedin-content/` and
   this procedure to `.claude/skills/linkedin-content/`. No project yet?
   `cargo-ai cdk init <dir> --cookbook linkedin-content && cd <dir> && npm install` does both. **If
   you are reading this from the project's `.claude/skills/`, the install already happened — start
   at step 2.**
2. **Reconcile it with what is already declared.** If the project already has a GitHub or Anthropic
   connector, rewire the imports to the existing one and drop the copy; two resources with one slug
   is a collision at deploy.
3. **Name the author.** Set `CONTENT_AUTHOR` in `infra/agents/content-writer.ts` to the person the
   posts are written as. The prompt refuses to run while it reads `PLACEHOLDER`.
   `references/post.md` (installed beside this file) is the draft shape.
4. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted; _What you will be asked_ is the floor, and you derive before you ask. Record
   what you changed and why under a `## Decisions` section in your copy of this file.
5. **Check, then plan.** `node --import tsx evals/contract.mjs` from this skill's folder, then
   `npm run check && cargo-ai cdk plan` from the project root. Show the diff, and deploy only on an
   explicit yes: `cargo-ai cdk deploy`. Never `cdk init --force` into a non-empty directory.
6. **Verify.** Send the agent its trigger text once by hand (`cargo-ai ai message create`), and walk
   _Done when_ line by line. Then send it again: it must update the same pull request.

## What you will be asked

**Derive before you ask.** Only the inputs marked _asked_ genuinely live in the operator's head.

| Input                                                     | Kind  | How it is answered                                                                                                                                                         | Why it matters                                                                                                                                |
| --------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTENT_AUTHOR` (`infra/agents/content-writer.ts`)       | asked | the person the posts are written as, the way they sign their name                                                                                                          | Every draft is in the first person. A team name produces posts nobody can publish as themselves.                                              |
| repository binding                                        | value | **derived**: leave `repository` without `repository`/`defaultBranch`/`connector`; `plan` fills them from the checkout's git origin. `cargo-ai cdk check` prints the binding. | The drafts are read from and written to this repository. A hand-written `owner/name` opens the pull request against the wrong one.            |
| what context/ holds                                       | value | **derived**: `ls context/*/` before the first run. A repository with no `proof/` or `insight/` files gets drafts that say so.                                                 | The agent can only draft what is written down. An empty `proof/` is a reason to install `call-capture` or `win-loss-review` first, not to invent. |
| GitHub and Anthropic connectors                           | value | **derived**: `cargo-ai connection connector list`; `cargo-ai cdk add connector/github` if missing. `languageModel` is a placeholder to set.                                 | GitHub is the agent's only write path. Anthropic is what every Monday is billed against.                                                      |

Checked before moving on, not after the deploy:

- `cargo-ai cdk check` prints `agent:linkedin_content_writer bound to <your repo>#<branch>` with no
  trailing `infra/`
- `context/` has at least one file under `global/` and one under `proof/` or `insight/`
- `node --import tsx evals/contract.mjs` passes

## What you can change

| Variation            | When it is right                                                    | How                                                                                                                                                                                    | What it costs                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `more-or-fewer`      | The author posts daily, or once every two weeks                     | Change `POSTS_PER_WEEK` in `infra/agents/content-writer.prompt.ts`                                                                                                                     | Past three or four a week the drafts start repeating proof points; the eight-week look-back in §2 only partly holds that off.                                                                                                     |
| `two-authors`        | A founder and a head of sales both post                             | A second agent with its own slug, `CONTENT_AUTHOR` and pull request title prefix                                                                                                                   | Two writers read the same context and can draft the same proof point the same week. Give each a different first kind in §3.                                                                                                     |
| `performance-report` | The author wants to know which posts landed before drafting the next | Add LinkedIn's `extractProfilePostActivity` to `uses` with the author's profile URL locked in `config`, and a §2 step that reads last week's posts and writes their reactions into the file | It is a paid action, billed per run (read its live price first), and it needs a LinkedIn connector. It is read-only; never add a write action to get it. Not the default because most teams want drafts before they want analytics. |
| `slack-heads-up`     | The author lives in Slack, not in pull requests                     | Add `slack.actions.postMessage` with a locked `channelId` and a closing step that posts the hooks and the pull request link                                                            | One more connector and one post a week. The drafts still land only in the pull request.                                                                                                                                          |
| `another-day`        | The team reviews on Fridays                                         | Change `cron` in `infra/agents/content-writer.ts`                                                                                                                                      | A run before `web-capture`'s Monday run drafts from last week's web findings.                                                                                                                                                    |

## What should not change

- **Nothing on the agent can publish.** (`infra/agents/content-writer.ts`) No LinkedIn action of any kind:
  no like, comment, connect, follow or message. An agent that can act on LinkedIn
  can speak as a person in public, and one bad draft becomes a post with the author's name on it.
  The contract fails if any of those lands on `uses`.
- **Every claim has a file.** (`infra/agents/content-writer.prompt.ts` §3) A number with no source
  is the fastest way to have a customer correct the author in the comments. Cut it rather than
  soften it.
- **A customer without reference permission is not named.** (§2) The `client/` file's
  `reference_permission` is what the team agreed to. Naming a customer who did not agree is a
  relationship problem, not a content one.
- **One file and one pull request per week.** (§1) The re-run check is what keeps a second Monday
  trigger, or a manual run, from opening a duplicate that a reviewer merges by mistake.
- **No `context` capability, and no writes under `context/`.** (`infra/agents/content-writer.ts`)
  The drafts read the knowledge layer; they do not change it. A capability would be a write path
  that skips the review every other pipeline goes through.

## Done when

- `node --import tsx evals/contract.mjs` passes
- `cargo-ai cdk plan` reports the agent, the two connectors and the folder
- the first run opened one pull request, `[linkedin-content] <week>`, containing only
  `cadence/content/<week>.md` in the `references/post.md` shape
- every draft lists its sources, and every number, customer and quote in it appears in one of them
- no customer whose `client/` file lacks reference permission is named
- a second run the same week linked the open pull request, opened no second one and changed nothing
- nothing was posted to LinkedIn or anywhere else

## What it costs

No connector action runs: the agent reads files in its checkout and opens a pull request through
GitHub. The recurring cost is the harness run itself, once a week, billed as LLM tokens through the
Anthropic connector, and it scales with how much of `context/` and `cadence/` there is to read.

The `performance-report` variation adds one paid LinkedIn action per run. Before adding it, read its
live price: `cargo-ai orchestration action list extractProfilePostActivity --kind connector
--integration-slug linkedin`, and say it out loud.

## Composes into

`call-capture`, `win-loss-review` and `web-capture` (they write the proof, insights and objections
the drafts are built from), and `standup` (whose log entries are this week's material).
