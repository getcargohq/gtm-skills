---
name: ask-cargo
description: 'One agent the whole team @mentions in Slack, sitting on top of your GTM repo and workspace: it answers from context, cadence and live runs, turns change requests into pull requests, and hands work to the other deployed agents only after a go in the thread. Triggers: "let the team ask our GTM agent from slack", "one agent on top of all the others", "a slack bot that knows our repo", "ask cargo from slack", "multiplayer GTM agent in slack", "orchestrator agent for our GTM stack", "let anyone open a PR from slack". Cargo CDK, defineAgent, harness claudeCode, Slack connector trigger, GitHub, cargo-ai CLI, ai message create. Skip when: you want the day recapped and posted to Slack on a schedule, which is standup; or you want an answer in this chat right now with nothing deployed.'
version: "0.1.1"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.67 or later — 1.0.66 brought `harness` and the harness repository spec, 1.0.67 roots the agent at the package.json that declares the CDK rather than at `infra/`. On 1.0.66, declare `rootDirectory: \".\"` yourself. Also needs a Cargo workspace, an authenticated LLM connector (the harness runs against Cargo's proxy), a GTM repository (the shape `cargo-ai cdk init` scaffolds), and authorized GitHub and Slack connectors."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/ask-cargo
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

# Ask Cargo

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

Anyone on the team types `@Cargo` in a Slack channel and gets the agent that knows the whole GTM
repo and the workspace behind it. One thread is one conversation, and anyone in the thread can steer
it. Three kinds of request land:

1. **Questions.** "What is our ICP for fintech?", "did the scorer run last night?", "what did we
   spend on enrichment this week?". It answers from `context/`, `cadence/`, `infra/` and read-only
   `cargo-ai` calls, and cites the file or the command.
2. **Changes.** "Add Ramp to our competitors", "tighten the disqualifiers". It makes the edit on a
   branch and replies with a pull request. One thread, one pull request; a follow-up in the thread
   is another commit on it. It never merges and never deploys.
3. **Work.** "Re-score Acme", "run the weekly plan now", "enrich these five domains". It proposes
   what will run, over how many records, at what live price, and does nothing until someone replies
   `@Cargo go`. When a deployed agent owns the job (the scorer, the planner, the standup) it hands
   the request to that agent with `cargo-ai ai message create` instead of redoing it.

This is not the workspace's built-in Master Agent. That one answers from context and models with no
checkout and cannot change anything. Ask Cargo exists for what needs the repository: reading what is
declared, and turning a Slack message into a reviewable diff. The resources are in
`infra/ask-cargo/agents/ask-cargo.ts` and the rules beside it in `ask-cargo.prompt.ts`.

How Slack reaches it, which shapes the rules (verified against the platform, not assumed):

- **Only @mentions wake it**, in any channel the bot is in, including follow-ups in a thread it already
  answered. A mention sent while it is still working is dropped, not queued. So every reply that
  needs an answer says exactly what to type next.
- **The platform posts the reply.** The agent's final text streams into the thread. There is no
  `postMessage` on the agent, and the prompt forbids the Slack tools the trigger adds on its own.
- **It does not know who wrote a message.** The Slack user id stays in trigger metadata the model
  never sees, so a pull request quotes the request and does not name the requester.

## Example

> Put one agent in our #gtm Slack channel that answers from this repo, opens a pull request for any edit, and runs nothing until someone says go.

Illustrative output, fictional records:

```text
#gtm
Dana:   @Cargo add Globex to our competitors, they keep showing up in fintech deals
Cargo:  Opened https://github.com/northwind-example/gtm/pull/212 on branch ask-cargo/add-globex-competitor.
        • Adds Globex to context/ competitors with the fintech positioning from this thread
        • `cargo-ai cdk check` passes; nothing under infra/ changed
        Want a battlecard section too? Reply @Cargo with what to add.
Dana:   @Cargo also note they undercut on price for teams under 50 seats
Cargo:  Pushed a second commit to the same pull request (#212): pricing note added.
        Review and merge it when it reads right; I never merge.
```

One thread became one reviewable pull request with two commits; a request that spends, such as
re-scoring an account, would instead get a proposal with its live price and wait for `@Cargo go`.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-project` skill is in your session it carries the long form of this; if not,
this is enough.

1. **Install it — the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/ask-cargo` writes this example to `infra/ask-cargo/` and this
   procedure to `.claude/skills/ask-cargo/`. No project yet?
   `cargo-ai cdk init <dir> --cookbook ask-cargo && cd <dir> && npm install` does both; this
   folder never ships a shell. **If you are reading this from the project's `.claude/skills/`, the
   install already happened — start at step 2.** On a CLI too old to have `add`, copy this folder in
   as a sibling of what is there by hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** If the project already has a GitHub, Slack or
   Anthropic connector (standup and weekly-planning each bring one), rewire the imports to the
   existing one and drop the copy; two resources with one slug is a collision at deploy.
3. **Check where the bot already is.** Authorize the Slack connector if the workspace does not have
   one (`cargo-ai cdk add connector/slack`). The trigger is `allChannels`, so the agent answers in
   every channel the bot has been invited to: list them from the connector's channel autocomplete
   and flag any customer shared (Slack Connect) channel before deploying.
4. **Write the roster.** Fill `references/roster.md` from `cargo-ai ai agent list`: which deployed
   agent owns which job. The prompt reads it from the installed skill folder.
5. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted; _What you will be asked_ is the floor, and you derive before you ask. Record
   what you changed and why under a `## Decisions` section in your copy of this file.
6. **Plan, then stop.** `node --import tsx evals/contract.mjs` from this skill's folder, then
   `npm run check && cargo-ai cdk plan` from the project root, show the diff, and deploy only on an explicit yes: `cargo-ai cdk deploy`. Never
   `cdk init --force` into a non-empty directory.
7. **Verify.** Walk _Done when_ line by line and report each with evidence. Read out loud the
   channels the bot is in before you call this done: a customer shared channel among them is the
   failure nobody can undo.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked.

| Input                                                     | Kind  | How it is answered                                                                                                                                                                                                                                                | Why it matters                                                                                                                                                                                                                  |
| --------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| repository binding (`infra/agents/ask-cargo.ts`)          | value | **derived**: `repository` is omitted, so `plan` binds the project's own repository from the git origin of the checkout, with the project's GitHub connector. `cargo-ai cdk check` prints what it resolved: confirm it names your repo and the root, not `infra/`.                               | This is the checkout every answer reads and every pull request opens against. An `owner/name` typed by hand is the value nobody notices is wrong until a pull request lands on a stranger's repository.                         |
| Slack, GitHub and LLM connectors (`infra/connectors/`)    | value | **derived**: `cargo-ai connection connector list` shows what is authorized; `cargo-ai cdk add connector/<slack\|github\|anthropic>` opens the consent for what is missing. All three are `default: true` because a deploy cannot mint a grant.                      | Slack is the trigger, GitHub the only write path, Anthropic what every turn is billed against. A harness paired with a non-Anthropic connector typechecks green and fails at deploy.                                            |
| channel reach (`infra/agents/ask-cargo.ts`)               | value | **derived**: `allChannels: true`, so the reach is every channel the bot is in. Read them from the Slack connector's channel autocomplete; `cargo-ai ai agent list` shows which other agents list channels of their own.                                            | The agent reads the ICP, the pipeline and the spend out loud to whoever is in the channel. A customer shared channel the bot is in leaks all of it. A channel another agent lists stays that agent's, and a second `allChannels` agent answers alongside this one. |
| roster (`references/roster.md`)                           | value | **derived**: `cargo-ai ai agent list` for what is deployed, each agent's description for what it owns.                                                                                                                                                            | Without it the agent guesses which agent owns a job from names alone, and "re-score Acme" goes to the wrong one or gets re-done by hand.                                                                                        |

Checked before moving on, not after the deploy:

- `cargo-ai cdk check` prints `agent:ask_cargo bound to <your repo>#<branch>` with no trailing
  subdirectory
- every channel the bot is in is internal, or is listed on another agent that owns it, and no other
  agent's trigger is also `allChannels`
- `node --import tsx evals/contract.mjs` passes

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something.

| Variation             | When it is right                                                                                     | How                                                                                                                                                                                                  | What it costs                                                                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `answer-only`         | You want a Slack oracle over the repo first, and no one running anything from Slack yet              | In `infra/agents/ask-cargo.prompt.ts`, replace §3 and §4 with "propose the command, never run it"                                                                                                    | The team copies commands out of Slack into a terminal, and "the agent said it would cost X" stops being checked against what actually ran.                                                                                            |
| `listed-channels`     | The bot sits in channels it must never answer in, or you want answers in a few channels only        | Replace `allChannels: true` with `channelIds: ["C…"]` in `infra/agents/ask-cargo.ts`, from the connector's autocomplete                                                                            | A list to keep in sync: a new team channel gets no answer until someone edits the file and deploys. Listing a channel also takes it from any `allChannels` agent.                                                                  |
| `dms-too`             | Individuals want to ask privately                                                                    | Add each person's Slack **user id** (`U…`) to `channelIds` next to `allChannels`; DMs are listed by user, not by `D…` channel, and `allChannels` never covers them.                                   | The thread stops being multiplayer: nobody else sees the proposal or the go, so a DM go is one person approving spend alone. Keep §3 unchanged if you take this.                                                                    |
| `master-agent-slack`  | You only need questions answered, no repo and no pull requests                                       | Skip this cookbook. Put a Slack trigger on the workspace's built-in Master Agent in the UI.                                                                                                          | No checkout: it cannot read `infra/` or `cadence/`, and it cannot change anything. Cheaper and faster per question, because there is no sandbox to start.                                                                           |
| `no-handoff`          | No other agents are deployed yet                                                                     | Delete §4 of the prompt and `references/roster.md`                                                                                                                                                   | Every job is redone by this agent from scratch, without the owning agent's rules. Add §4 back the day the first pipeline deploys.                                                                                                    |
| `higher-sample-bar`   | Your runs are expensive per record, or touch people                                                  | Lower the 25-record threshold and the 5-record sample in §3 of the prompt                                                                                                                            | More round trips in the thread for every batch, and each one needs another `@Cargo go`.                                                                                                                                            |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The bot is kept out of customer shared channels.** (`infra/agents/ask-cargo.ts`) The trigger is
  `allChannels`, so where the bot is invited is where the agent answers. A shared channel the bot
  joined for something else is a channel where the first question reads the ICP and the pipeline to
  the customer. Remove the bot there, or list the channel on the agent that owns it.
- **Nothing on `uses`.** (`infra/agents/ask-cargo.ts`) The trigger replies by itself, so a
  `postMessage` use is a second way to post, to any channel. A sub-agent or tool on `uses` is a path
  that skips the go in the thread, and a sub-agent handle imports another cookbook's file. The
  contract fails on any of the four.
- **Spend, sends and handoffs wait for a go in the thread.** (`infra/agents/ask-cargo.prompt.ts`)
  Anyone in the channel can @mention it. Without the gate, a half-typed "enrich everything" runs a
  batch over the whole model, and the only record of who approved it is a Slack thread nobody
  reread. The go approves the proposal as written, never more records or a higher cost.
- **Changes are one pull request per thread, never a merge, never a deploy.**
  (`infra/agents/ask-cargo.prompt.ts`) The merge is the approval. An agent that deploys from Slack
  turns a mistyped message into a production change with no diff anyone read.
- **The agent never calls the Slack tools.** (`infra/agents/ask-cargo.prompt.ts`) The trigger hands
  it `postMessage` with no channel lock, plus history and search. A reply is its final text, in the
  thread it was asked in; anything else is how an internal answer lands in the wrong channel.
- **It hands work to the owning agent instead of redoing it.** (`infra/agents/ask-cargo.prompt.ts`)
  A scorer's rules live in the scorer's prompt. Redoing the job here produces a second score with
  none of those rules, and the two disagree in the CRM.
- **It does not claim to know who asked.** (`infra/agents/ask-cargo.prompt.ts`) The model is not
  told. A pull request that names a requester names a guess.

## Done when

- `node --import tsx evals/contract.mjs` passes: harness is `claudeCode` on an Anthropic connector,
  one Slack trigger on `allChannels`, nothing on `uses`, no capability
- `cargo-ai cdk plan` reports the agent, the three connectors and the folder
- a question in a channel the bot is in ("what is our ICP?") got an answer in the thread that cites a file
  under `context/`
- a question about the workspace ("what failed yesterday?") cites the `cargo-ai` command it ran; a
  read that errored says so instead of a number
- a change request opened exactly one unmerged pull request, and a follow-up in the same thread
  added a commit to it rather than opening a second
- a request that spends replied with a proposal and a live price and ran nothing; the same request
  ran only after `@Cargo go`
- a request an installed agent owns was handed to it with `cargo-ai ai message create`, and the reply
  names the chat or pull request it produced
- a mention in a channel another agent lists got that agent's reply, not this one's

## What it costs

Every turn is a harness run: a sandbox, a clone of the repository, and LLM tokens billed through the
bound Anthropic connector. A turn that only answers a question costs tokens and nothing else. The
read-only `cargo-ai` calls are API calls, not connector actions, and bill nothing.

What spends is what someone approves with a go: the connector actions, batches and agent handoffs in
§3 of the prompt. The agent reads each price live (`cargo-ai connection integration get <slug>`) and
says the total before it asks for the go, so the proposal is the cost line. Nothing runs on a
schedule.

## Composes into

`standup` and `weekly-planning` (it can run either on demand, and answers "what happened this week"
from the logs they write), `account-scoring` and `crm-enrichment` (it hands them one-account
requests instead of scoring or enriching by hand), `call-capture` (the call entries are context it
answers from), `agentic-engagement` (it can report what a thread did, never send on its behalf).
