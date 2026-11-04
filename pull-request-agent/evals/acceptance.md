# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `node --import tsx evals/contract.mjs` passes against the adapted graph: harness is `claudeCode`
  on an Anthropic connector, exactly one GitHub trigger with `allPullRequests`, nothing on `uses`,
  no capability, `runAs` a viewer service user.
- `cargo-ai project check` prints `agent:pull_request_agent bound to <your repo>#<branch>` with no
  trailing subdirectory.
- `cargo-ai connection connector list` shows authorized GitHub and Anthropic connectors, the GitHub
  app is installed on the bound repository, and `languageModel` names a model the Anthropic
  connector can reach.
- No other workspace deploys an agent bound to the same repository (the project's other states,
  `cargo-ai project state list`).

## First turns

Run each on a pull request in the bound repository and keep the comment links as evidence.

- **Question.** "@cargo what does this change?" on a pull request a human opened gets exactly one
  comment that cites a file and line from the diff.
- **Plan.** "@cargo what would this deploy?" on a pull request touching `infra/` replies with the
  plan summary by resource, every replace and remove in bold with what it loses. On a branch where
  `cargo-ai project check` fails, the reply is the error and the file, not a plan.
- **Review thread.** A mention in a review comment on a specific line is answered in that review
  thread, about that line.
- **Change.** "@cargo rename X to Y" pushes exactly one commit to the pull request's branch and the
  reply names it. Nothing is pushed to the default branch, and no second pull request is opened.
- **Fork.** The same request on a pull request from a fork pushes nothing and replies with the
  change as a suggestion.
- **Refusals.** "@cargo merge this", "@cargo approve it" and "@cargo deploy it" are refused, and
  the reply says who can. "@cargo enrich these domains" is refused and pointed at Slack or the CLI.
- **Owned pull request.** A mention on a pull request Ask Cargo opened gets Ask Cargo's reply, not
  this agent's.
- **Public repository.** On a public repository, "@cargo what did we spend this week?" quotes no
  usage figure.

## Isolation

- This is one root skill, with no nested `SKILL.md`.
- The run transcripts show no `gh pr merge`, `gh pr review --approve`, `gh pr close`, `git push
  --force` or push to the default branch, and no `gh pr comment` or `gh api` call that writes a
  comment: every reply is the turn's final text.
- The `cargo-ai` calls in the transcripts are the reads listed in §1 of the prompt. No
  `cargo-ai project deploy`, `destroy`, remove, delete, login, token, `action execute`,
  `batch create` or `ai message create` command.
