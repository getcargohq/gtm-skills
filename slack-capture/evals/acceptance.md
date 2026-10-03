# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `node --import tsx evals/contract.mjs` passes against the adapted graph: harness is `claudeCode`
  on an Anthropic connector, one Slack trigger listing `C…`/`G…` channel ids and never
  `allChannels`, `getThread` on `uses` and no Slack action beyond `getThread`, `listUsers` and
  `addReaction`, nothing else on `uses`, no capability.
- `cargo-ai cdk check` prints `agent:slack_scribe bound to <your repo>#<branch>` with no trailing
  subdirectory, and the GitHub grant can push a branch to that repository.
- `cargo-ai connection connector list` shows authorized Slack, GitHub and Anthropic connectors.
- Every id in `channelIds` was read out loud from the Slack connector's channel autocomplete, is
  internal, and has the bot in it.
- `cargo-ai ai agent list` was read, and the channels this agent takes from an `allChannels` agent
  were named to the operator.

## First captures

Keep the thread links and the pull request as evidence.

- **Capture.** A test thread with two replies and a mention produces one raw file with every message
  verbatim and a `source:` line, one entry, one reply naming both and the pull request, and a
  :white_check_mark:.
- **Unchanged.** A second mention with no new reply writes nothing and replies with the existing
  entry.
- **Grown.** A mention after one new reply writes a raw file holding only that reply.
- **Same day.** Two captures that day land on one `[slack-capture] <date>` pull request.
- **Bar.** A first-hand claim already in a call entry, captured in a thread about a different
  account, is promoted citing both. A claim with one occurrence is not. Two captures of one thread
  are counted once.
- **Refusals.** A mention in a shared channel is refused with nothing written. A mention in an
  unlisted channel gets no reply from this agent.

## Isolation

- This is one root skill. Its supporting Markdown lives under `references/`, and no nested
  `SKILL.md` exists.
- No import leaves the folder.
- The run transcripts show no Slack post, search or history read, no CRM call, and no merge.
