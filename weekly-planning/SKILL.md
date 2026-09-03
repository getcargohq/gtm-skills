---
name: weekly-planning
description: 'Every Monday last week''s GTM work is ranked against active initiatives, declared infra, and live runs, as one reviewable pull request per initiative — or one workspace pull request when there are none. Triggers: "what should we work on this week", "rank our initiatives against what is actually running", "weekly GTM plan from the cadence log", "recommend next work from infra and runs", "the play is deployed but I don''t think it ran". Cargo CDK, defineAgent, harness claudeCode, GitHub, platform capability, initiatives, cadence. Skip when: you want today recapped and posted to Slack, which is standup; or you want call transcripts scribed into context, which is call-capture.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.67 or later — 1.0.66 brought `harness` and the harness repository spec, 1.0.67 roots the agent at the package.json that declares the CDK rather than at `infra/`. On 1.0.66, declare `rootDirectory: \".\"` yourself. Also needs a Cargo workspace and a GTM repository with `cadence/` at its root (the shape `cargo-ai cdk init` scaffolds). `initiatives/` is optional: without it the run still opens one workspace pull request."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/weekly-planning
metadata:
  author: getcargo
  source: cookbook
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

# Weekly planning

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

What to do next stops living in someone's head until the next planning meeting. Every Monday one
agent runs, and two things land:

1. **The raw dump.** A committed script writes last week's git commits, pull requests, initiative
   inventory, declared infra, and cadence files dated in that week into
   `cadence/log/raw/planning/<YYYY-Www>.md`. That is the evidence, and it is never edited by the
   agent.
2. **The recommendation file(s).** The agent reads the dump, the workspace (runs, usage, models,
   via the platform capability), and the initiative files, and writes markdown a human can merge:
   - **No active initiatives** — one file, `cadence/plan/YYYY-Www.md`, one pull request titled
     `[cadence] workspace YYYY-Www`. It checks what is happening: declared infra, live runs, usage.
   - **One or more active initiatives** — one file and one pull request **per** initiative, titled
     `[cadence] <slug> YYYY-Www`. Two bets do not share a diff.

Then it stops. A human merges. Recommendations are not a deploy: the agent does not edit `infra/`,
does not start a play, and does not merge itself.

This is a scheduled CI workflow plus a hosted agent, collapsed into resources declared in the same
project as everything else the workspace runs. The schedule and the repository binding live in
`infra/weekly-planning/agents/planner.ts`, and the instructions beside it in `planner.prompt.ts`.
`harness: "claudeCode"` is what buys the working tree: the output of a week is a diff across
markdown files, and only an agent with a checkout can produce one.

Three properties make it safe enough to run unattended:

- **The collection is deterministic.** The agent does not fetch PRs. `scripts/collect/week.ts`
  does, the same way every Monday, and the agent is told not to improvise that step. Workspace data
  (runs, usage, models) comes from the platform capability, not a second fetch the agent invents.
- **One pull request per initiative, or one for the workspace.** Combining five bets into one diff
  is how a reviewer merges the loud one and skips the overdue one. Splitting them is the gate.
- **The pull request is the gate.** The agent has repository write access and no other write path.
  It cannot email anyone, cannot touch the CRM, cannot execute a platform action that spends, and
  cannot merge itself.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it — the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/weekly-planning` writes this example to `infra/weekly-planning/`
   (resources **and** `scripts/`) and this procedure to `.claude/skills/weekly-planning/`. No
   project yet? `cargo-ai cdk init <dir> --cookbook weekly-planning && cd <dir> && npm install` does
   both; this folder never ships a shell. **If you are reading this from the project's
   `.claude/skills/`, the install already happened — start at step 2.** On a CLI too old to have
   `add`, copy this folder in as a sibling of what is there by hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** If the project already has a GitHub connector or
   an agents folder, rewire the imports to the existing one and drop the copy; two resources with
   one slug is a collision at deploy. Append this folder's env needs to the project's `.env.example`;
   never overwrite it.
3. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted (nobody asks for a variant they do not know exists); _What you will be asked_ is
   the floor, and you derive before you ask. If you are asking more than about four questions you
   have skipped lookups. Record what you changed and why under a `## Decisions` section in your copy
   of this file.
4. **Run the collector by hand once, then plan.** `npx tsx
   scripts/weekly-planning/collect/week.ts --dry-run` first: it prints the dump and writes nothing.
   Then drop `--dry-run`. If it does not produce a raw file locally it will not produce one on a
   schedule, and that is far cheaper to find out now. Then
   `node --import tsx evals/contract.mjs && npm run check && cargo-ai cdk plan`, show the diff, and
   deploy only on an explicit yes: `cargo-ai cdk deploy`. Never `cdk init --force` into a non-empty
   directory.
5. **Verify.** Walk _Done when_ line by line and report each with evidence. Deployed cleanly and
   produced nothing is the normal failure.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the ones marked
_asked_ genuinely live in the operator's head.

| Input                                              | Kind  | How it is answered                                                                                                                                                                                                                          | Why it matters                                                                                                                                                                                                                          |
| -------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| repository binding (`infra/agents/planner.ts`)     | value | **derived**: leave `repository`, `defaultBranch` and `connector` unset and `plan` fills them from the git origin of the checkout, taking the GitHub connector from the project's own. `cargo-ai cdk check` prints what it resolved: confirm the line reads your repo and `./`. | This is the working tree the harness clones and the only place its plan files can land. An `owner/name` written by hand is the one value nobody notices is wrong until a pull request opens against a stranger's repository.            |
| GitHub connector (`infra/connectors/git.ts`)       | value | **derived**: `cargo-ai connection connector list` shows whether one is authorized; if not, `cargo-ai cdk add connector/github` opens the OAuth consent. The declaration is `adopt: true` because a deploy cannot mint an OAuth grant.         | It is the agent's entire write path into the repository. Without it the run does the work and has nowhere to put it.                                                                                                                    |
| `PLANNING_TIMEZONE` (`infra/agents/planner.ts`)    | value | **derived**: default `America/Los_Angeles`. Change it only if the team's week is not Pacific. Change it together with `cron`.                                                                                                                 | The previous ISO week is computed in this timezone. A timezone the collector does not share with the prompt splits the dump and the plan files across two weeks.                                                                      |
| cadence and initiatives paths                      | value | **derived**: read `cadence/README.md` and `ls initiatives/` for what already exists                                                                                                                                                           | The agent writes into a layer humans already curate. A second parallel folder splits the record in half. An empty `initiatives/` is not an error: it is the one-workspace-PR path.                                                      |

Checked before moving on, not after the deploy:

- the collector was run by hand once and wrote a real raw file
- `cargo-ai cdk check` prints `agent:weekly-planning bound to <your repo>#<branch>` with no trailing
  subdirectory — the repo is the one holding `cadence/`, and the GitHub grant can push to it. A
  trailing `in infra/` is the failure to catch here: it roots the harness where there is no
  node_modules, so the collector cannot run
- `scripts/weekly-planning/package.json` is present in the project after the install
- `node --import tsx evals/contract.mjs` passes

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the
default.

| Variation        | When it is right                                                                                         | How                                                                                                                                                         | What it costs                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `move-the-hour`  | The team reads pull requests at a different time, or you are not on Pacific time                         | Change `cron` and `PLANNING_TIMEZONE` together in `infra/agents/planner.ts`. The cron is 15:00 UTC Monday because that is 8am PT in PDT.                    | A Sunday cron recaps an incomplete week. A timezone the collector does not share with the prompt splits the dump and the plan files across two weeks.                  |
| `skip-on-track`  | An on-track initiative should not ping the reviewer                                                      | In `infra/agents/planner.prompt.ts`, skip the pull request when The gap is "on track"                                                                       | Silence on an on-track week is indistinguishable from a missed run for that initiative. The default still opens the PR, because a written "keep going" is the record.  |
| `no-platform`    | This agent must not have execute tools on it, even as a prompt-forbidden list                            | Drop `capabilities` in `infra/agents/planner.ts` and §1b of `infra/agents/planner.prompt.ts`                                                                | The recap loses runs, usage, and model movement. The git dump still lands. Until the capability is live on the workspace, the default already continues from the dump if the tools error. |
| `one-pr`         | You want one weekly diff even when there are five initiatives                                            | Collapse step 2 of `infra/agents/planner.prompt.ts` to a single pull request that holds every plan file                                                     | The reviewer merges the loud initiative and skips the overdue one. The default splits them because that is the gate.                                                   |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The agent does not fetch git; the script does.** (`scripts/collect/week.ts`) A fetch loop an
  agent re-derives every Monday is a fetch loop that silently changes shape — a window that drifts, a
  `gh` flag that quietly widens. The raw dump is the one thing here that has to be byte-identical in
  its rules every week, because everything downstream is diffed against it. Cargo workspace data is
  the other half of the week, and it is the platform capability, not a `cargo-ai` CLI loop in the
  collector.
- **Zero active initiatives is one workspace pull request. N active is N pull requests.**
  (`infra/agents/planner.prompt.ts`) Combining them is how a reviewer merges one bet and skips
  another. Opening a workspace pull request *and* the initiative ones is how unclaimed runs get a
  second home they were not asked to have: they stay in the dump.
- **The platform capability is read-only.** (`infra/agents/planner.ts`,
  `infra/agents/planner.prompt.ts`) `execute_action` and `execute_action_batch` spend, and a
  recommendation is not a deploy. Leaving those tools callable is how a planner starts a batch it
  cannot undo. Until the capability is on the workspace, the tools error and the recap continues
  from the git dump — it does not invent the numbers.
- **`scripts/weekly-planning/package.json` stays.** (`scripts/package.json`) It is not decoration.
  The CDK loader imports every `.ts` under the project root except directories carrying a
  `package.json`; delete it and `cargo-ai cdk plan` imports the collector and runs git/`gh` on every
  plan.
- **The harness root stays the directory holding the `package.json` that declares `@cargo-ai/cdk`.**
  (`infra/agents/planner.ts`) That is where `node_modules` is, so it is the only place
  `npx tsx …/collect/week.ts` resolves — and in the scaffolded layout it is the repository root,
  which is also where `cadence/` and `initiatives/` live. **Check it, do not assume it:**
  `cargo-ai cdk check` prints the resolved binding, and a line ending `in infra/` means the harness
  was rooted where there is no package.json and no node_modules. The collector then cannot run at
  all, and Monday reports clean and empty. On a CLI old enough to resolve it that way, pin
  `rootDirectory: "."` in the repository block until you upgrade.
- **The agent opens pull requests and never merges them.** (`infra/agents/planner.prompt.ts`) The
  recommendation is what next week's work is chosen from. Remove the review gate and a hallucinated
  gap, a play misread as idle, or a stuck item filed against the wrong owner becomes the team's
  next bet.
- **Do not invent a number.** (`infra/agents/planner.prompt.ts`) Drop a metrics line rather than
  carry last week's ARR forward. A made-up delta is worse than no delta, because the plan file is
  what leadership reads. A platform-tool error is a note on the PR, not a count you fill in.
- **Never edit `plan/` or `infra/`.** (`infra/agents/planner.prompt.ts`) The planner recommends. A
  pull request that rewires a play is a deploy wearing a plan file's name.

## Done when

- `--dry-run` printed the dump for the previous ISO week, and the run without it wrote
  `cadence/log/raw/planning/<YYYY-Www>.md`; running it twice that Monday overwrote the same file
- `node --import tsx evals/contract.mjs` passes: harness is `claudeCode`, the platform capability
  is on the agent, there is no Slack action, and no tool wraps git or platform
- `cargo-ai cdk plan` reports the agent, the GitHub connector and the folder, and does **not** run
  git or `gh` while planning
- with **zero** active initiatives, the first scheduled run opened exactly one unmerged pull
  request titled `[cadence] workspace <YYYY-Www>` whose diff contains the dump and
  `cadence/plan/<YYYY-Www>.md` with `## Recommendations`
- with **N** active initiatives, it opened exactly N unmerged pull requests, one per slug, each
  diff containing the dump and exactly one `cadence/plan/<YYYY-Www>-<slug>.md` — never a second
  initiative in the same diff
- a re-run the same Monday opened no additional pull request for a target whose
  `## Recommendations` section was already on disk
- no number in a plan file is absent from the raw dump, a metrics file dated that week, or a
  platform tool the agent actually called. A platform-tool error is a note on the PR, not a
  made-up count

## What it costs

The collector talks to git and, when `gh` is installed, to GitHub from the harness environment.
Those calls are not Cargo connector actions.

The recurring cost is the harness run itself, once a week, and it scales with how much the agent
reads — the dump, the week's cadence files, the active initiative files, declared infra, and the
platform reads (whoami, runs, usage, models). There is no per-record fan-out. `execute_action` is
on the capability; this recap never calls it.

## Composes into

`standup` (the week's daily logs are evidence this recap reads), `call-capture` (scribed calls dated
in the week are evidence), `tam-building` and `account-scoring` (a declared play that did not run is
the gap this recap is for).
