# Replicas runs launched from this repo

`.github/workflows/cargo-deps-update.yml` bumps `@cargo-ai/cdk` and the
`cli-version` pin every morning and gates the bump on every cookbook still
passing `cargo-cdk check` and `plan`. When that gate fails, it launches a
Replicas run to fix the cookbooks on the bump branch instead of leaving a red
pull request for someone to find days later.

Prompts live in `prompts/` so the instructions an agent runs on are reviewed in a
pull request like any other code.

| Prompt | Launched by | When |
| --- | --- | --- |
| `prompts/fix-cookbooks.md` | `cargo-deps-update.yml` | the bump gate failed |

## Setup

The launch step needs two secrets. Until they exist the workflow still bumps,
still gates, and still opens the pull request — it just cannot launch a fixer,
and the job goes red so the gap is visible rather than silent.

| Secret | Where to get it |
| --- | --- |
| `REPLICAS_API_KEY` | Replicas dashboard → API keys |
| `REPLICAS_ENV_ID` | the Replicas environment the run should execute in |

Add them as repository secrets (Settings → Secrets and variables → Actions). The
environment needs whatever credentials a fixer run requires to check the
cookbooks — in practice a `CARGO_API_KEY`, held in the Replicas environment and
never in this repo.

`getcargohq/cargo-fsd` uses the same two secrets for its scheduled runs, so an
existing key can be reused.

## Why the POST is not retried

Creating a replica is not idempotent. A request the server accepted but answered
slowly, retried, starts a second agent on the same branch — two agents pushing
cookbook fixes to one branch. The workflow therefore posts once and lets the job
go red on failure. A visible failed launch beats an invisible duplicate one; this
is a lesson carried over from `cargo-fsd`, where retried launches ran Standup
twice most mornings before it was found.
