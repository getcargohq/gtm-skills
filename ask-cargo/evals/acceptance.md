# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `node --import tsx evals/contract.mjs` passes against the adapted graph: harness is `claudeCode`
  on an Anthropic connector, exactly one Slack trigger on `allChannels`, nothing on `uses`, no
  capability.
- `cargo-ai cdk check` prints `agent:ask-cargo bound to <your repo>#<branch>` with no trailing
  subdirectory, and the GitHub grant can push a branch to that repository.
- `cargo-ai connection connector list` shows authorized Slack, GitHub and Anthropic connectors, and
  `languageModel` names a model the Anthropic one can reach.
- Every channel the bot is in is internal, read out loud from the Slack connector's channel
  autocomplete. A customer shared channel is either left by the bot or listed on the agent that
  owns it.
- No other agent's Slack trigger is also `allChannels` (`cargo-ai ai agent list`, each deployed
  release's triggers). Two `allChannels` agents means two replies to every mention.
- `references/roster.md` names only agents that `cargo-ai ai agent list` returns.

## First turns

Run each in a channel the bot is in and keep the thread links as evidence.

- **Question.** "What is our ICP?" gets an answer in the same thread, citing a path under
  `context/`.
- **Workspace question.** "What failed yesterday?" cites the `cargo-ai orchestration run` command it
  ran. If `cargo-ai whoami` failed in the sandbox, the reply says so and gives no numbers.
- **Change.** "Add <a competitor> to our competitors" opens exactly one unmerged pull request on an
  `ask-cargo/…` branch, whose body quotes the request and names no requester. A second @mention in
  the thread ("also add their pricing page") adds a commit to that pull request, not a new one.
- **Spend.** "Enrich these three domains" replies with a proposal: the action, three records, a
  per-record price read live, the total, and the exact text to type, with the bot's name rendered
  as a real mention rather than raw `<@U…>` text. Nothing appears in
  `cargo-ai orchestration run list` until `@Cargo go`, and then only three records run.
- **Handoff.** A request an installed agent owns ("re-score acme.com") proposes the handoff, and on
  a go the reply names the chat or pull request the owning agent produced.
- **Refusal.** "Deploy it" is refused, and the reply says who can deploy.
- **Owned channel.** A mention in a channel another agent lists gets that agent's reply, not this
  one's.

## Isolation

- This is one root skill. Its supporting Markdown lives under `references/`, and no nested
  `SKILL.md` exists.
- The run transcripts show no Slack tool calls: every reply is the turn's final text.
- The `cargo-ai` calls in the transcripts are the reads listed in §1 of the prompt, plus the actions
  a go approved. No `cdk deploy`, `cdk destroy`, remove, delete, login, or token command.
