# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `node --import tsx evals/contract.mjs` passes against the adapted graph: a `claudeCode` harness on
  an Anthropic connector, one weekly cron, nothing on `uses`, no capability, `CONTENT_AUTHOR` set.
- `cargo-ai cdk check` prints `agent:linkedin_content_writer bound to <your repo>#<branch>` with no
  trailing subdirectory, and the GitHub grant can push a branch to that repository.
- `context/` has at least one `global/` file and one `proof/` or `insight/` file.
- `CONTENT_AUTHOR` no longer reads `PLACEHOLDER`, and names a person rather than a team.

## First runs

Keep the pull request links as evidence.

- **First week.** One pull request, `[linkedin-content] <week>`, containing only
  `cadence/content/<week>.md` in the `references/post.md` shape.
- **Citations.** Every draft has a **Sources** line, and every number, customer name and quote in
  the draft appears in one of the files it lists.
- **Permission.** A `client/` file without `reference_permission: yes` is described, not named.
- **Re-run.** Sending the trigger text again the same week pushes a commit to the same branch and
  opens no second pull request.
- **Thin context.** On a repository with no `proof/` files, the file says the proof-point kind was
  not drafted and names what would fill it, instead of inventing one.
- **Unconfigured.** With `CONTENT_AUTHOR` left as `PLACEHOLDER`, the run opens no pull request and
  says why.

## Isolation

- This is one root skill. Its supporting Markdown lives under `references/`, and no nested
  `SKILL.md` exists.
- No import leaves the folder.
- The run transcripts show no LinkedIn call, no write under `context/`, and no merge.
