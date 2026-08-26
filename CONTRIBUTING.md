# Contributing

Every folder at the root of this repo is one skill, installed on its own with
`npx skills add getcargohq/gtm-skills/<name>`. Two kinds live side by side and
the validators tell them apart by one frontmatter line:

| Kind     | Marker                      | What the folder holds                                                                                               | Validated by                                                         |
| -------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| one-off  | `metadata.source: one-off`  | `SKILL.md`: a job an agent runs in a turn, with the exact `cargo-ai` command and its price                          | `scripts/validate.ts` (slugs and prices against the Cargo playbooks) |
| cookbook | `metadata.source: cookbook` | `SKILL.md` plus worked CDK resources (`models/`, `plays/`, `agents/`, …) an agent adapts into a project and deploys | `scripts/check-cookbooks.mjs`                                        |

`metadata.source` must be exactly one of those two values; a missing or
unknown one fails `validate.ts`, so a typo cannot silently make a cookbook a
one-off.

Both are graded by the same routing evals (`evals/routing.jsonl`), because a
one-off and a cookbook compete for the same prompts and that
seam is the whole point: "build a TAM list" is `build-tam-list` (a list today)
and "keep our TAM current" is `tam-building` (a pipeline that keeps producing
it).

## Local setup

```sh
npm install            # repo tooling only: yaml, prettier, typescript, the CDK for typechecking the examples
npm run validate       # everything CI runs, minus the routing evals
npm run typecheck      # the CDK examples; needs `cargo-ai login` then `npm run types` first
```

Nothing in the root `package.json` ships to anyone. A customer's project shell
comes from `cargo-ai cdk init --template blank`; a skill is a folder they copy.

## Checks

| Command                                     | What it does                                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node scripts/validate.ts`                  | one-off skills: every slug and price against `getcargohq/cargo-skills` playbooks, plus the plugin channel                                                                      |
| `node scripts/check-cookbooks.mjs`          | cookbooks: frontmatter parses as YAML, the contract sections exist, **no relative import escapes the folder**, the to-be-approved banner follows `.github/data/approvals.json` |
| `node scripts/generate-llms-txt.ts --check` | `llms.txt` in sync                                                                                                                                                             |
| `node scripts/build-catalog.mjs --check`    | `catalog.json` in sync (the one machine-readable view of the whole repo)                                                                                                       |
| `npx prettier --check .`                    | the CDK example code and repo scripts                                                                                                                                          |
| routing evals                               | CI checks out `getcargohq/cargo-skills` and runs its `routing-eval.ts --skills-root .`                                                                                         |

When writing a new skill, follow
[`.agents/skills/create-gtm-skill/SKILL.md`](.agents/skills/create-gtm-skill/SKILL.md).
That file is for authors; it is not a customer skill. Codex loads it from
`.agents/skills`. Claude Code and Cursor load the same folder via symlink
(`.claude/skills`, `.cursor/skills`).

## Adding a one-off skill

Unchanged: `<name>/SKILL.md` with the four-part description (job → literal
quoted triggers → proper nouns → `Skip when:`), a self-contained Setup, the
exact command, the price, the star ask. Register it in `skills.sh.json`,
`hooks/skill-loads.sh` and the README table; `validate.ts` tells you where.

## Adding a cookbook

**Every cookbook is isolated.** It carries every model, connector and folder
its resources import; no relative import may leave it. There is no shared
foundation and no requires graph. Two cookbooks in one project will both carry,
say, an `accounts` model, and that is fine: the agent placing the second one
sees the first and rewires to it. Isolation is what lets a customer install
exactly one skill and get exactly one working thing.

1. `<name>/` with the resource code (`models/`, `plays/`, `agents/`, …) and a
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
   - `## Put it in your project`: the compact procedure. Look at the repo,
     `cdk init --template blank` if there is no project, copy the folder in as
     a sibling and reconcile with what is already declared, adapt, plan and
     stop, deploy on a yes, verify. Copy it from `tam-building/SKILL.md`; each
     skill carries its own, the way every one-off skill carries its own Setup.
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
4. Register it: `skills.sh.json` (the "Make it run forever" grouping),
   `hooks/skill-loads.sh`, the README, and an entry in
   `.github/data/approvals.json` (`state: to-be-approved`, empty evidence).
5. At least two routing cases in `evals/routing.jsonl`: one that should reach
   this skill, one that must reach the one-off sibling instead.
6. `npm run validate`, then a PR against `main`.

**A folder without a `SKILL.md` is not a skill and does not belong at the root.**
Sixteen cookbooks (`contact-sourcing`, `signal-based-tam`, `ai-sdr`,
`rep-cockpit`, …) were written before their skills and are kept in history, not
in the tree: restore one with `git checkout 305cd88 -- <name>`, write its
`SKILL.md`, and it lands with the skill. The validator refuses a resource folder
that carries no skill.

## Approval

Every cookbook is **to be approved** until Cargo has tested it in a
fresh demo workspace **and** two customers or partners have implemented it.
That state and its evidence live in `.github/data/approvals.json`, which no
customer sees. The customer sees the banner in `SKILL.md`, and the validator
requires it exactly while the state is `to-be-approved` and refuses it once
`approved`, so flipping the data file and forgetting the customer file is a red
build. Implementations are `{date, ref}`, with `ref` pointing at the internal
record rather than naming the customer in a public file. Cargo makes no public
outcome claim for a skill that is not approved.

## Every resource must earn its deploy

A cookbook combines several resource types, but that is a description of
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

- Read secrets with `secret("NAME")` and say so under _What you will be asked_
  as an `env` input; never inline a value.
- Keep `defineContext` paths relative to the project root, and remember it is
  a per-workspace singleton: an example that ships one says what to do when
  the project already has one.
- App and worker bundles under `*/apps/*` and `*/workers/*` are self-contained
  sub-projects (own `tsconfig` and deps) and are excluded from the root
  typecheck.
