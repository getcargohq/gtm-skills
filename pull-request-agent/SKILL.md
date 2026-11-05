---
name: pull-request-agent
description: 'Put an agent on every pull request in your go-to-market repo: anyone who mentions @cargo on a pull request gets an agent with the branch checked out that explains the diff, says what merging would deploy (what it creates, replaces and removes), and pushes the fixes it is asked for to the branch, never merging or deploying. Triggers: "an agent that answers on our pull requests", "mention cargo on a PR", "tell me what this PR would deploy", "reviewers mention cargo to fix the PR", "a github reviewer that knows our repo", "plan every infra pull request". Cargo project, defineAgent, harness claudeCode, GitHub connector trigger, cargo-ai project plan. Skip when: the team asks from Slack, which is ask-cargo; or you want CI to gate merges, which is a GitHub Action running cargo-ai project plan.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.104 or later, which brings `repository.runAs` and `defineUser`. Also needs a Cargo workspace, an authenticated Anthropic connector (the harness runs against Cargo's proxy), a GTM repository on GitHub (the shape `cargo-ai project init` scaffolds), and a GitHub connector whose app is installed on that repository."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/pull-request-agent
metadata:
  author: getcargo
  source: cookbook
  personas:
    - gtm-engineering
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

# Pull request agent

**State: to-be-approved.**

## The outcome

Anyone who can comment on the GTM repository types `@cargo` on a pull request and gets an agent
with that pull request's branch checked out. One pull request is one conversation. Three kinds of
request land:

1. **Questions.** "What does this change?", "why did the scorer prompt move?". It answers from the
   diff, the files it touches and `context/`, and cites the file and line.
2. **What merging would deploy.** On any pull request that touches `infra/`, "@cargo what would
   this deploy?" runs `cargo-ai project check` and `plan` on the branch and replies with what it
   creates, updates, replaces and removes, with every replace and remove in bold and what it loses.
3. **Changes.** "@cargo rename this field", "@cargo address the review". It commits to the pull
   request's branch and replies with the commit. It never merges, approves, deploys or
   force-pushes, and it cannot push to a fork's branch, so there it replies with a suggestion.

It spends nothing. No connector action, batch, play run or agent handoff is in reach: anyone who
can comment steers it, so it reads the workspace as a viewer and changes only git. The resources
are in `infra/pull-request-agent/agents/pull-request-agent.ts` and the rules beside it in
`pull-request-agent.prompt.ts`.

How GitHub reaches it, which shapes the rules (verified against the platform, not assumed):

- **A mention wakes it**: `@cargo`, `@cargo-ai` or the GitHub app's own handle, in a pull request
  comment or a review comment. The message names the author, the pull request, and for a review
  comment the file and line.
- **The platform posts the reply.** The agent's final text becomes a comment on the pull request,
  or a reply in the review thread it was mentioned in. Its own comments carry a marker, so a reply
  never wakes it.
- **A pull request another agent opened stays with that agent.** A pull request Ask Cargo opened
  from Slack keeps routing mentions to Ask Cargo's chat; this agent answers on the rest.
- **Failing checks and reviews only wake it on a pull request it opened itself**, which happens
  only when someone asks for a follow-up. A stranger's red CI is nobody's request.

## Example

> Put an agent on our GTM repo's pull requests that tells reviewers what a merge would deploy and fixes what they ask.

Illustrative output, fictional records:

```text
northwind-example/gtm #318  "Score accounts on headcount growth"
Priya:  @cargo what would this deploy?
Cargo:  `cargo-ai project plan` on score-headcount-growth:
        • update  play:score_accounts (new headcount_growth input)
        • update  agent:tier_analyst (prompt)
        • **replace model:account_scores — the column type changes, its 4,210 rows are rebuilt**
        Check passes. Mention me to keep the old column instead.
Priya:  @cargo keep the old column and add a new one
Cargo:  Pushed 3f2a91c: adds headcount_growth_pct beside the old column.
        Plan is now update-only: nothing replaced or removed.
```

A replace nobody had noticed was caught in review and turned into an update-only change with one
more commit; nothing was merged or deployed by the agent.

## Put it in your project

This folder is a **worked example**: real project resources written for some other company. The job
is to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-project` skill is in your session it carries the long form of this; if not,
this is enough.

1. **Install it — the CLI does the copy.** From inside the project (the folder holding
   `cargo.json`), `cargo-ai project add cookbook/pull-request-agent` writes this example to
   `infra/pull-request-agent/` and this procedure to `.agents/skills/pull-request-agent/`. No
   project yet? `cargo-ai project init <dir> --cookbook pull-request-agent && cd <dir> && npm install`
   does both; this folder never ships a shell. **If you are reading this from the project's
   `.claude/skills/`, the install already happened — start at step 2.** On a CLI too old to have
   `add`, copy this folder in as a sibling of what is there by hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** If the project already has a GitHub or
   Anthropic connector, or the adopted `viewer` role (ask-cargo, standup and weekly-planning each
   bring some), rewire the imports to the existing one and drop the copy; two resources with one
   slug is a collision at deploy.
3. **Check the repository is reachable.** Authorize GitHub if the workspace has no connector
   (`cargo-ai project add connector/github`), and confirm its app is installed on the repository
   this project lives in.
4. **Check no other workspace binds this repository.** Staging and production projects deployed
   from one repository are two workspaces on one repository, and then a mention on a pull request
   no agent opened gets no answer at all. Deploy this agent to one workspace only, normally
   production.
5. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted; _What you will be asked_ is the floor, and you derive before you ask. Record
   what you changed and why under a `## Decisions` section in your copy of this file.
6. **Plan, then stop.** `node --import tsx evals/contract.mjs` from this skill's folder, then
   `npm run check && cargo-ai project plan` from the project root, show the diff, and deploy only on
   an explicit yes: `cargo-ai project deploy`. Never `cargo-ai project init --force` into a non-empty
   directory.
7. **Verify.** Walk _Done when_ line by line and report each with evidence.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked.

| Input                                                       | Kind  | How it is answered                                                                                                                                                                                                            | Why it matters                                                                                                                                                                                      |
| ----------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| repository binding (`infra/agents/pull-request-agent.ts`)  | value | **derived**: `repository` declares only `runAs`, so `plan` binds the project's own repository from the git origin of the checkout, with the project's GitHub connector. `cargo-ai project check` prints what it resolved. | The repository is also the trigger's boundary: the agent answers on pull requests in the repository its release is bound to, and nowhere else.                                                     |
| service user (`infra/users/index.ts`)                       | value | **derived**: `pull_request_agent`, a service user on the adopted `viewer` system role. Deploying creates it; the deploying user's own role must cover viewer.                                                                | Every turn's `cargo-ai` session. `plan` needs one; viewer is what keeps "never deploy" true when a comment talks the agent past its prompt.                                                         |
| GitHub and LLM connectors (`infra/connectors/`)             | value | **derived**: `cargo-ai connection connector list` shows what is authorized; `cargo-ai project add connector/<github\|anthropic>` opens the consent for what is missing. Both are `default: true`.                          | GitHub is the trigger and the only write path, Anthropic what every turn is billed against. A harness paired with a non-Anthropic connector typechecks green and fails at deploy.                  |
| other workspaces on this repository                         | value | **derived**: the project's other states (`cargo-ai project state list`), and whether any of them deploys an agent bound to this repository.                                                                                | Two workspaces on one repository and the platform refuses to pick one: mentions on pull requests no agent opened go unanswered, and nothing reports it.                                            |

Checked before moving on, not after the deploy:

- `cargo-ai project check` prints `agent:pull_request_agent bound to <your repo>#<branch>` with no
  trailing subdirectory
- no other workspace deploys an agent bound to the same repository
- `node --import tsx evals/contract.mjs` passes

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something.

| Variation          | When it is right                                                                 | How                                                                                                                                                | What it costs                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `answer-only`      | You want explanations and plans on pull requests, but nobody pushing through it  | In `infra/agents/pull-request-agent.prompt.ts`, replace §3 with "put the change in the reply as a suggestion; never commit"                          | Every fix is copied by hand out of a comment, and a suggestion nobody applies is a review that went nowhere.                                                           |
| `own-prs-only`     | Another agent already answers on every pull request                             | Set `allPullRequests: false` in `infra/agents/pull-request-agent.ts`, and give the agent a Slack or cron trigger that opens pull requests            | The agent answers only on pull requests it opened. With no other trigger it opens none, so it never answers: the contract fails on it for that reason.                |
| `no-check-fixing`  | CI on this repository is slow or flaky                                          | Set `fixFailedChecks: false`; or lower `maxCheckFixAttempts` (default 3)                                                                            | A red pull request the agent opened waits for a human. Each fix attempt is a harness turn.                                                                            |
| `opus-for-plans`   | Pull requests change many resources and the plan summary needs judgment        | Set `languageModel` to a larger Anthropic model                                                                                                   | Every turn costs more, including the one-line questions.                                                                                                              |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The sandbox runs as a viewer service user.** (`infra/users/index.ts`) Anyone who can comment on
  the repository steers this agent. With a write role, a comment that talks it past its prompt can
  deploy or edit a resource; with no `runAs`, `plan` fails on every turn. The contract fails on
  either.
- **Nothing on `uses`, no capability.** (`infra/agents/pull-request-agent.ts`) A connector action,
  tool or sub-agent is a path to spend or send from a pull request comment, with no go and no
  record but the comment. The contract fails on any of them.
- **It never merges, approves, deploys or force-pushes.** (`infra/agents/pull-request-agent.prompt.ts`
  §3) The merge is the approval, by a human, and the deploy follows the merge. An agent that merges
  its own commit reviews itself.
- **`allPullRequests` stays on.** (`infra/agents/pull-request-agent.ts`) Without it the agent
  answers only on pull requests it opened, and it opens none on its own: the trigger deploys green
  and nothing ever answers.
- **One workspace per repository.** (step 4 above) A second workspace binding the same repository
  silences the catch-all for both, with no error anywhere.
- **Workspace data stays off public repositories.** (`infra/agents/pull-request-agent.prompt.ts` §5)
  A comment on a public repository is public. Usage, run details and model rows belong in Slack or
  the CLI.

## Done when

- `node --import tsx evals/contract.mjs` passes: harness is `claudeCode` on an Anthropic connector,
  one GitHub trigger with `allPullRequests`, nothing on `uses`, no capability, `runAs` a viewer
  service user
- `cargo-ai project plan` reports the agent, the two connectors, the folder, the
  `pull_request_agent` user and the adopted `viewer` role
- "@cargo what does this change?" on a pull request a human opened got one comment that cites a file
  and line from the diff
- "@cargo what would this deploy?" on a pull request touching `infra/` replied with the plan
  summary, every replace and remove in bold; on a branch where check fails, it replied with the
  error instead
- "@cargo rename X to Y" pushed exactly one commit to that pull request's branch and replied with it;
  the same request on a fork's pull request replied with a suggestion and pushed nothing
- "@cargo merge this" and "@cargo deploy it" were refused
- a mention on a pull request Ask Cargo opened got Ask Cargo's reply, not this agent's
- every mention produced exactly one comment

## What it costs

Every mention is a harness run: a sandbox, a clone of the pull request's branch, and LLM tokens
billed through the bound Anthropic connector. `cargo-ai project check` and `plan` are API reads and
bill nothing. Nothing runs on a schedule, and the agent runs no connector action, so a turn costs
its tokens and nothing else. A failing check on a pull request it opened is one more turn per
attempt, up to `maxCheckFixAttempts`.

## Composes into

Pairs with `ask-cargo`: a change asked for in Slack becomes a pull request there, and the review
happens here. It gets more useful with every pipeline whose resources live in `infra/`, because
each one is one more thing a plan summary can catch before it is replaced.
