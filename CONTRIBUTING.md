# Contributing

Every folder at the root of this repo is one skill, installed on its own with
`npx skills add getcargohq/gtm-skills/<name>`. Two kinds live side by side and
the validators tell them apart by one frontmatter line:

| Kind     | Marker                      | What the folder holds                                                                                               | Validated by                                                         |
| -------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| one-off  | `metadata.source: one-off`  | `SKILL.md`: a job an agent runs in a turn, with the exact `cargo-ai` command and its price                          | `scripts/validate.ts` (slugs and prices against the Cargo playbooks) |
| cookbook | `metadata.source: cookbook` | `SKILL.md` plus worked CDK resources (`models/`, `plays/`, `agents/`, …) an agent adapts into a project and deploys | `scripts/check-pipelines.mjs`                                        |

`metadata.source` must be exactly one of those two values; a missing or
unknown one fails `validate.ts`, so a typo cannot silently make a cookbook a
one-off.

Both are graded by the same routing evals (`evals/routing.jsonl`), because a
one-off and a pipeline compete for the same prompts and that
seam is the whole point: "build a TAM list" is `build-tam-list` (a list today)
and "keep our TAM current" is `tam-building` (a pipeline that keeps producing
it).

## Local setup

```sh
npm install            # repo tooling only: yaml, prettier, typescript, the CDK for typechecking the examples
npm run validate       # everything CI runs, minus the routing evals
npm run typecheck      # the CDK examples against the installed package types
```

Nothing in the root `package.json` ships to anyone. A customer's project shell
comes from `cargo-ai cdk init`; a skill is a folder the CLI copies in for them.

## Checks

| Command                                     | What it does                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/validate.ts`                  | one-off skills: every slug and price against `getcargohq/cargo-skills` playbooks; every skill: personas and `## Example`; the plugin channel |
| `node scripts/check-pipelines.mjs`          | pipeline skills: frontmatter and sections, folder isolation, no fixed credit amounts, isolated `infra/` CDK check and plan, approval state   |
| `npm run typecheck`                         | repository TypeScript, including pipeline resource examples                                                                                  |
| `node scripts/generate-llms-txt.ts --check` | `llms.txt` in sync                                                                                                                           |
| `node scripts/build-catalog.mjs --check`    | `catalog.json` in sync (the one machine-readable view of the whole repo)                                                                     |
| `npx prettier --check .`                    | the CDK example code and repo files, except the three generated or legacy scripts listed in `.prettierignore`                                |
| routing evals                               | CI checks out `getcargohq/cargo-skills` and runs its `routing-eval.ts --skills-root .`                                                       |

When writing a new skill, follow
[`.agents/skills/create-gtm-skill/SKILL.md`](.agents/skills/create-gtm-skill/SKILL.md).
That file is for authors; it is not a customer skill. Codex loads it from
`.agents/skills`. Claude Code and Cursor load the same folder via symlink
(`.claude/skills`, `.cursor/skills`).

## What every skill carries, whichever kind

Two things feed the catalog page a reader sees before installing, so
`validate.ts` requires them of both kinds:

- **`metadata.personas`**: 1–3 values, primary first, from a closed list:
  `sales-development`, `account-executive`, `revops`, `sales-leadership`,
  `marketing`, `gtm-engineering`. It is who runs the job day to day, and it is a
  filter on the site, so a new value is a change to the validator, not a typo
  that makes a filter of one.
- **`## Example`**: one `> ` line in the user's own words, then the literal line
  `Illustrative output, fictional records:`, then what comes back (a table or a
  fenced block, about 20 lines at most). Fictional companies on the reserved
  `.example` TLD, never a real person. A one-off's closing line quotes credits
  that its own cost table adds up to; a cookbook shows what the deployed
  pipeline writes (the CRM fields, the Slack message, the pull request) and
  quotes no credits, which `check-pipelines.mjs` would refuse anyway. No
  commands in it: the validator would count them as calls. A one-off places it
  just before `## What it costs`, a cookbook just after `## The outcome`.

`build-catalog.mjs` lifts both into `catalog.json`, along with the integrations
each skill touches (a one-off's called `integrationSlug`s, a cookbook's
`defineConnector` integrations), so none of that is written twice.

## Adding a one-off skill

`<name>/SKILL.md` with the four-part description (job → literal quoted triggers
→ proper nouns → `Skip when:`), a self-contained Setup, the exact command, the
example, the price, the star ask. Register it in `skills.sh.json`,
`hooks/skill-loads.sh` and the README table; `validate.ts` tells you where.

## Adding a pipeline skill

**Every pipeline skill is isolated.** It carries every model, connector and folder
its resources import; no relative import may leave it. There is no shared
foundation and no requires graph. Two pipeline skills in one project will both carry,
say, an `accounts` model, and that is fine: the agent placing the second one
sees the first and rewires to it. Isolation is what lets a customer install
exactly one skill and get exactly one working thing.

**Recommendations, not requirements.** Every pipeline skill carries one list in
its frontmatter `metadata`, so a reader (and the site, through `catalog.json`)
can see what it sets up without a requires graph:

- `suggestedNext`: pipelines this one sets up well. `crm-deduplication` lists
  `account-scoring` because scoring is worth more on consolidated records.

The reverse view, `metadata.suggestedBefore`, is generated into the same
frontmatter by `build-catalog.mjs` from every other pipeline's `suggestedNext`, so an
agent reading one SKILL.md sees both directions. Never edit it by hand: change
`suggestedNext` on the other pipeline and regenerate; `--check` fails when it is stale. The list is not a
precondition and not a build order: the skill must still install and work on its
own, the agent placing it never installs a listed pipeline unasked, and two
pipelines may feed each other. Empty is fine.

`## Composes into` is the prose for that list: it says why each listed pipeline
comes next, and it names no other pipeline in this repo. One-off skills and
pipelines that do not exist yet may still appear there. `check-pipelines.mjs`
checks that every name is a pipeline skill here, that a pipeline does not list
itself, and that the prose and the list name the same pipelines.

1. `<name>/` with the resource code (`models/`, `plays/`, `agents/`, or `infra/`) and a
   `README.md` that explains why the design is the way it is. Every value that
   must be edited before deploy carries a `PLACEHOLDER` comment.
2. `<name>/SKILL.md` with `metadata.source: cookbook` and the standard
   frontmatter only (`name`, `description`, `version`, `compatibility`,
   `homepage`, `metadata`). **Quote any value containing a colon-space**:
   unquoted, YAML reads it as a nested mapping and `npx skills add` skips the
   file with a warning nobody reads.
3. The body opens with the honest banner, `**State: to-be-approved.**`, and
   carries these sections in this order; the validator checks each exists:
   - `## The outcome`
   - `## Example` (see above)
   - `## Put it in your project`: the compact procedure. `cdk add cookbook/<name>`
     (or `cdk init --cookbook <name>` when there is no project) is the copy step,
     then reconcile with what is already declared, adapt, plan and stop, deploy
     on a yes, verify. Copy it from `tam-building/SKILL.md`; each skill carries
     its own, the way every one-off skill carries its own Setup. Say early that
     a reader who found this in a project's `.claude/skills/` is past the copy —
     the section is also what the CLI hands an agent after installing.
   - `## What you will be asked`: a table of inputs, **derive before ask**.
     An input that can be looked up (which connector is authenticated, what
     the CRM schema holds) is marked _derived_; if more than about four rows
     are genuinely asked, the interview is too long. Every row says why.
   - `## What you can change`: the reshapes you expect, each with when it is
     right, how, and what it costs. Nobody asks for a variant they do not know
     exists, so the agent offers these unprompted. A variation with no cost is
     the default in hiding.
   - `## What should not change`: what must stay true however far it is
     adapted, each with the concrete symptom if violated. This is what the
     agent argues back with; an operator who still wants it gets it, recorded.
   - `## Done when`: the acceptance test, one checkable line each.
   - `## What it costs`, `## Composes into`.
4. Register it: `skills.sh.json` (its stage grouping: Context, Fundamentals,
   Signals, Engagement, Operations, or Connect your CRM),
   `hooks/skill-loads.sh`, the README, and an entry in
   `.github/data/approvals.json` (`state: to-be-approved`, empty evidence).
5. At least two routing cases in `evals/routing.jsonl`: one that should reach
   this skill, one that must reach the one-off sibling instead.
6. `npm run typecheck`, `npm run validate`, and `npm run format:check`, then a PR against `main`.

**A folder without a `SKILL.md` is not a skill and does not belong at the root.** A pipeline skill has
one root `SKILL.md`; supporting agent instructions belong in `references/`, never in nested
skills.
Sixteen pipeline examples (`contact-sourcing`, `signal-based-tam`, `ai-sdr`,
`rep-cockpit`, …) were written before their skills and are kept in history, not
in the tree: restore one with `git checkout 305cd88 -- <name>`, write its
`SKILL.md`, and it lands with the skill. The validator refuses a resource folder
that carries no skill.

## What CI enforces, and why

The markdown is the source — edit it directly. Copy is meant to be iterated on: reword a job,
add a trigger phrase, rewrite a CTA, tune the framing. That is the point of this repo being
separate from the pack. What is not free-form:

**Slugs and prices are checked against the upstream playbooks.** Every `integrationSlug` /
`actionSlug` pair in a command must exist in the matching
[`cargo-gtm/provider-playbooks/`](https://github.com/getcargohq/cargo-skills/tree/main/cargo-gtm/provider-playbooks)
file, and every number in a cost table must match that playbook exactly. These skills run inside
agents we do not control, with no session refresh to save them — a stale price fails on a new
user's first command, which is the worst possible moment to be wrong.

**Every skill carries the same blocks:** the `cargo-gtm` deference guard, the free-credits
line, the sample-before-you-spend rule, the CTA back to the pack, the star ask, and the
attribution guard that skips the manual session row when the plugin's hooks already write one.
Drop one and the build goes red. Trigger phrases must also be unique across skills, or they fight
for the same prompts.

**The plugin channel is checked too.** The four manifests
(`.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `plugin.json`) must agree on name and
version, every hook they wire must exist and be executable, `cli-version` must be a real version,
`skills.sh.json` must group every skill exactly once, the skill list embedded in
[`hooks/skill-loads.sh`](hooks/skill-loads.sh) must match the directory tree, and
`hooks/approve-cli.sh` must be byte-identical to the pack's. Adding a new skill therefore
means registering it in several places, and the build will tell you which one you missed.

```bash
node scripts/validate.ts                                            # against cargo-skills@main
node scripts/validate.ts --playbooks ../cargo-skills/cargo-gtm/provider-playbooks   # local checkout
node scripts/validate.ts --ref v1.18.1                              # pin to a tag
```

CI also runs this weekly on a cron. Upstream pricing can change without anyone touching this
repo, and that is exactly the drift nobody would otherwise notice.

`evals/routing.jsonl` holds one case per trigger phrase, graded in CI by the pack's ranker
(`.github/scripts/routing-eval.ts --skills-root .`). It currently scores 72/72, which is a
ceiling effect rather than a result: every case was generated from the trigger phrases it
grades, so it proves the triggers do not collide, not that the descriptions route. Real cases
have to come from real sessions.

## The plugin channel

What the plugin wires, in full:

- **An approval hook** ([`hooks/approve-cli.sh`](hooks/approve-cli.sh)) that auto-approves safe
  `cargo-ai` calls (reads, queries, run and batch operations) so the agent stops prompting on every
  invocation, while credentials (`login`), token minting, report egress, and any `remove`/`delete`
  always still prompt. Allow-only — it can never override a deny rule. Wired per target:
  `PreToolUse` (Claude Code), `PermissionRequest` (Codex), `beforeShellExecution` (Cursor). The
  file is a **verbatim copy** of the pack's, and CI fails if it drifts: an allowlist should be
  reviewed once, upstream, for both plugins — not forked here.
- **Session-lifecycle hooks** (Claude Code only): `SessionStart` installs the CLI at the version
  [`cli-version`](cli-version) pins — so a command in a SKILL.md always meets the CLI it was
  written against — and `Stop`/`SessionEnd` keep the session row titled and current instead of
  leaving a placeholder behind. They derive the attribution line each skill otherwise asks the
  agent to write by hand, so the skills' own attribution step stands down when the plugin is
  installed and a session is recorded once, not twice.

For the **OpenAI Plugins Directory** (ChatGPT + Codex) the archive is built from the tree rather
than hand-assembled, because that listing is the one channel that does not track this repo — every
version is a manual, human-reviewed submission that then serves whatever was approved:

```bash
node scripts/build-codex-package.mjs      # -> dist/gtm-skills-codex.zip
```

It stages the 32 skills under `skills/`, drops the OpenClaw `metadata` block OpenAI rejects,
writes the directory manifest, and asserts every documented limit — description lengths, the
30-char display fields, square icons, archive shape — against the finished zip rather than the
staging directory. Skills only: the hooks are wired with `${CLAUDE_PLUGIN_ROOT}`, which nothing
outside Claude Code is known to set, so packaging them would put a path that cannot run in front
of a reviewer. CI builds it on every commit; `dist/` holds the bytes that were uploaded.

## Keeping the toolchain current

[`cargo-deps-update.yml`](.github/workflows/cargo-deps-update.yml) bumps
`@cargo-ai/cdk` and the `cli-version` pin every morning onto the stable branch
`automation/cargo-deps`, so a newer version refreshes one pull request rather than
stacking a second.

The gate is the interesting part. `tsc` cannot see a CDK contract change: the CDK
validates inside `defineAgent` and friends, at call time, so a cookbook that
stopped being deployable still typechecks green. The bump is therefore gated on
`scripts/check-pipelines.mjs`, which runs `cargo-cdk check` and `plan` against
every cookbook's `infra/`. When that fails, the pull request opens as a draft and
a Replicas run is launched to fix the cookbooks on the branch — the CDK is
usually right and the cookbook is usually stale. The prompt it runs on is
[`.replicas/prompts/fix-cookbooks.md`](.replicas/prompts/fix-cookbooks.md), and
[`.replicas/README.md`](.replicas/README.md) covers the two secrets it needs.

`scripts/validate.ts` is deliberately not part of that gate: it resolves slugs and
prices against `getcargohq/cargo-skills`, so it can be red for reasons a bump did
not cause. `validate.yml` still runs it against the pull request.

## Approval

Every pipeline skill is **to be approved** until Cargo has deployed it end to
end in a live workspace and walked its `Done when` line by line. That run's
date is the evidence (`demoWorkspace`). Customer and partner implementations
are recorded as they happen, but approval does not wait for them.
That state and its evidence live in `.github/data/approvals.json`, which no
customer sees. The customer sees the banner in `SKILL.md`, and the validator
requires it exactly while the state is `to-be-approved` and refuses it once
`approved`, so flipping the data file and forgetting the customer file is a red
build. Implementations are `{date, ref}`, with `ref` pointing at the internal
record rather than naming the customer in a public file. Cargo makes no public
outcome claim for a skill that is not approved.

## Every resource must earn its deploy

A pipeline skill combines several resource types, but that is a description of
what real outcomes need, **not a quota to fill**. A resource nobody calls is
weight: it deploys, it shows up in the workspace, and it rots.

- **Do not wrap a single connector action in a tool.** If the workflow body is
  one `uses.<connector>.<action>(...)` call and a return, there is no tool:
  there is an action, and the user can call it from the CLI without deploying
  anything (which is exactly what the one-off skills do).
- **Segments should view outputs, not restate inputs.** A segment that repeats a
  play's own trigger filter is dead weight and a drift trap.
- **Do not map a value into a column of the wrong type** just to fill it.

## Conventions

- File every resource a pipeline skill deploys under workspace folders named
  after the skill (`defineFolder("<name>-agents", { kind: "agent", name: "<Name>" })`),
  not under a shared one. Folders are per-kind, so a skill deploying models and
  agents declares one of each. A workspace accumulates resources from several
  skills plus whatever the team wrote by hand, and the folder is what answers
  "what put this here, and what else came with it" by looking. It is also what
  makes removing a skill bounded rather than a hunt. Declare only the kinds the
  skill actually files something into: a folder nothing references is a resource
  that deploys, shows up in the workspace and rots.
- **Put a credential where it outlives the shell that set it.** Default to a
  workspace environment variable:
  `cargo-ai workspaceManagement envVar create --key NAME --secret` (CLI 1.0.89
  or later) stores it encrypted server-side, and omitting `--value` reads the
  exported variable so the key stays out of argv and shell history. It is read
  on every run, so a rotation lands with no deploy. Workers, apps and agents
  inherit the whole catalog, which means a harness agent's `repository.env`
  declares **nothing** for a key the workspace holds — and the CDK's type
  refuses a pointer there for exactly that reason. A connector is better off
  with no credential at all: `default: true` binds the connection the workspace
  already authorized, which is what every connector in this repo does, and the
  cost is that a deploy cannot mint one — a workspace without the connection
  fails at deploy rather than at plan, since binding declares no `config` to
  typecheck. When a connector genuinely has to be created, its credential field
  inherits nothing and reaches a catalog entry through `workspaceEnv("NAME")`
  (CDK 1.0.72 or later). Keep `secret("NAME")` for a
  value the deploy itself supplies: it resolves from the deploying machine's
  environment, so the variable has to be exported — or sit in a `.env` that the
  next machine does not have — by whoever deploys, and a rotation only lands on
  a re-apply. Never `env("NAME")` for a secret: that bakes the value into the
  content hash and therefore into `cargo.state.json`. Say which of the two a
  skill uses under _What you will be asked_ as an `env` input, and never inline
  a value.
- Keep `defineContext` paths relative to the project root, and remember it is
  a per-workspace singleton: an example that ships one says what to do when
  the project already has one.
- App and worker bundles under `*/apps/*` and `*/workers/*` are self-contained
  sub-projects (own `tsconfig` and deps) and are excluded from the root
  typecheck.
- A cookbook that ships runnable scripts puts them in `<name>/scripts/`, beside
  `<name>/infra/`. The install mirrors each top-level directory into its
  namesake in the project: `infra/` to `infra/<name>/`, `scripts/` to
  `scripts/<name>/`, matching the layers `cargo-ai cdk init` scaffolds. They
  are node code, so they are typechecked by `tsconfig.scripts.json`
  (`types: ["node"]`) rather than the root config, which keeps `*/infra/**`
  node-free; `npm run typecheck` runs both. They carry a `package.json` and no
  tsconfig of their own — a nested one is never auto-discovered by `tsc -p`, and
  a consumer project already covers `scripts/**/*.ts` from its root config. Keep
  the `package.json`: the CDK loader imports every `.ts` under the project root
  **except** directories carrying one, so in a project whose CDK root is the
  repo root, dropping it makes `cdk plan` execute the script.
