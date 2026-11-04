# Pull request agent: an agent on every pull request in your go-to-market repo

To get the review of the GTM repository done where it happens, deploy one agent anyone can mention
on a pull request. It reads the diff, says what merging would deploy, and pushes the fixes it is
asked for to the branch. A Claude Code harness agent with a GitHub connector trigger; nothing else
is deployed.

```sh
cargo-ai project add cookbook/pull-request-agent
```

## What it does

- **Explains.** Answers from the diff, the files it touches, and `context/`, citing file and line.
- **Plans.** Runs `cargo-ai project check` and `plan` on the branch and replies with what merging
  would create, update, replace and remove, with every replace and remove in bold.
- **Fixes, when asked.** Commits to the pull request's branch and replies with the commit. On a
  fork's branch it replies with a suggestion instead.
- **Looks after its own pull requests.** When it opened one, a failing check or a review wakes it
  to fix or answer.

## How it works

1. **Someone mentions `@cargo`** in a pull request comment or a review comment.
2. **The platform finds the agent**: the one whose deployed release is bound to that repository
   and whose GitHub trigger is set to all pull requests. A pull request another agent opened is left
   to that agent.
3. **The harness checks out the pull request's branch**, so a push lands on the pull request.
4. **The agent reads, plans or commits**, then its final text is posted as the reply, in the review
   thread when it was mentioned in one.

Adds 6 resources.

| File                                        | Resource                        | Role                                                       |
| ------------------------------------------- | ------------------------------- | ---------------------------------------------------------- |
| `infra/agents/pull-request-agent.ts`        | `defineAgent` (claudeCode)      | the GitHub trigger, repository binding, model              |
| `infra/agents/pull-request-agent.prompt.ts` | (not a resource)                | the rules: what it reads, plans, pushes, and never does    |
| `infra/connectors/git.ts`                   | `defineConnector` (`github`)    | the trigger, and the clone, push and comment path          |
| `infra/connectors/anthropic.ts`             | `defineConnector` (`anthropic`) | the model the harness runs on, billed and metered          |
| `infra/folders/index.ts`                    | `defineFolder`                  | the workspace folder this pipeline's agent is filed in     |
| `infra/users/index.ts`                      | `defineUser`, `defineRole`      | the viewer service user every turn's `cargo-ai` runs as    |

## Why a trigger and not a GitHub Action

A GitHub Action that runs `cargo-ai project plan` on every pull request is the right gate when the
question is "may this merge", and it costs nothing per pull request in tokens. This agent is for the
questions an Action cannot answer: what a replace actually loses, whether a prompt change matches
`context/`, and "change it so it does not". It runs only when someone asks, so a quiet pull request
costs nothing.

## Why it spends nothing

Anyone who can comment on the repository can mention it, and on GitHub there is no thread-wide "go"
like Ask Cargo's in Slack. So nothing that spends, sends or wakes another agent is in reach, in the
prompt or in the release: its Cargo session is a viewer, and it changes only git, where every change
is a commit a human merges.

## Placeholders (edit before deploy)

1. **`languageModel`** — `infra/agents/pull-request-agent.ts`: any Anthropic model the workspace's
   connector can reach.

## What it does not do

It does not merge, approve, close, deploy, force-push, push to the default branch, run connector
actions, batches or plays, message other agents, or post workspace data on a public repository.
