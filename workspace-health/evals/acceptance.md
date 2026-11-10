# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `node --import tsx evals/contract.mjs` passes against the adapted graph.
- `cargo-ai project check` prints `agent:workspace_health bound to <your repo>#<branch>`.
- `HEALTH_CHANNEL_ID` is an id resolved through the Slack connector's autocomplete, and the Cargo
  app is a member of that channel (otherwise the history read fails).
- The five queries in the prompt run by hand against this workspace without an error.

## First run

- With a known problem present (a play that used to run and is now disabled, or a workflow failing
  above `HEALTH_ERROR_RATE`), the post names it once, with the play's name and the cause.
- Every number in the post matches the same query re-run by hand.
- Failures are grouped: one line per workflow and cause, with a count.
- Nothing in the workspace changed: no run created or cancelled, no play enabled or disabled.

## Second run, same day

- Nothing new: no post.

## First Monday

- The weekly line was posted, with still-open, cleared and skipped counts, or all clear with the
  week's run and credit totals.

## When the session is missing

- If `cargo-ai whoami` fails in the sandbox, the post says it could not read the workspace. It never
  says all clear.
