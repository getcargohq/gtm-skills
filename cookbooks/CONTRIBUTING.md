# Contributing

Thanks for adding to the Cargo CDK cookbooks. A cookbook is a folder of
`define*` resources that combine 3+ CDK resource types into one applyable
outcome. Cookbooks compose by living in the same project root — every cookbook
builds on `base-gtm`.

## Local setup

```sh
nvm use                 # Node 20+ (see .nvmrc)
npm install             # postinstall syncs types if you are logged in (optional)
cp .env.example .env    # fill in the secrets the cookbooks you deploy need
```

`npm install` runs `cargo-ai cdk types`, which syncs integration schemas from your
workspace into `.cargo-ai/` (gitignored). Typechecking depends on those
generated types, so run `npm run types` before `npm run typecheck` on a fresh
clone.

## Checks

| Command                         | What it does                                                                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/validate.mjs`     | the scaffold graph, the skill layer, and the routing evals. Not an npm script on purpose: `package.json` ships to every scaffolded project and `scripts/` does not, so `npm run validate` there used to fail on the customer's first day |
| `node scripts/routing-eval.mjs` | cookbook descriptions graded against cargo-skills' 17 (`--llm` for the model tier)                                                                                                                                                       |
| `npm run typecheck`             | `tsc --noEmit` (needs generated types — run locally)                                                                                                                                                                                     |
| `npm run format`                | Prettier write                                                                                                                                                                                                                           |
| `npm run format:check`          | Prettier check                                                                                                                                                                                                                           |
| `npm run plan`                  | dry-run the resource graph against your workspace                                                                                                                                                                                        |

CI runs `node scripts/validate.mjs` and `npm run typecheck`: both work without a live workspace.
The routing evals inside it need a `cargo-skills` checkout beside this repo and
skip with a message when it is absent, so a bare clone still passes.
Run `npm run typecheck` and `npm run format:check` locally before opening a PR.

## Adding a cookbook

1. Create a folder named for the outcome (e.g. `lead-routing/`).
2. Put resources in conventional subfolders: `connectors/`, `models/`,
   `segments/`, `plays/`, `agents/`, `tools/`, `capacities/`, `territories/`,
   `context/`, `files/`, `apps/`, `mcp/`.
3. Import shared resources (CRM/Slack/waterfall/Cargo-DB/OpenAI connectors,
   `accounts`/`contacts` models, folders) from `base-gtm` — never redefine them.
4. Add a `README.md` stating the cookbook's resource graph, placeholders, and a
   "done when" check.
5. Register the folder in `cargo.scaffold.json` with its `requires` (the sibling
   cookbooks it imports from, `base-gtm` at minimum). `node scripts/validate.mjs` enforces
   this.
6. Add a row to the Cookbooks table in the root `README.md`.
7. Register the folder in `cargo.scaffold.json` with its `kind` (`outcome` for a
   use case somebody installs on purpose, `foundation` for a slot others build
   on) and, for an outcome, `state: "to-be-approved"` with an empty `approval`.
   Approval evidence goes there too, when it exists: `demoWorkspace` (the date
   every `Done when` line passed on a fresh workspace) and two `implementations`
   (`{date, ref}`, where `ref` points at the internal record rather than naming
   the customer in a public file).
8. If it is an outcome, add a `SKILL.md` (see below) and at least one routing
   eval case in `evals/routing.jsonl`. `node scripts/validate.mjs` reports every outcome
   that still lacks a skill.

## SKILL.md: the contract and the discovery surface in one file

A cookbook that is only code is not installable: the README says the
placeholders in prose, and whoever installs it has to read that prose and guess.
`SKILL.md` fixes that, and `scripts/check-cookbooks.mjs` gates it. Only outcome
cookbooks have one. `base-gtm` and `crm-sync` are `kind: foundation`: they
define no motion of their own, so a skill for them would compete for prompts it
cannot serve, and the validator refuses one.

**The code in a cookbook is a worked example, not a template with holes in it.**
Whoever installs it should end up with the code their company would have
written. So the skill says which parts may be reshaped and which may not, under
four fixed headings the validator checks for:

- **`## What you will be asked`**: a table of inputs. Write it derive-before-ask:
  an input that can be looked up (which connector is authenticated, what the CRM
  schema holds, how many closed-won rows there are) is marked _derived_, not
  _asked_. If more than about four rows are genuinely asked, the interview is
  too long. Every row says why it matters, which is what the agent says when the
  operator pushes back.
- **`## What you can change`**: the reshapes this cookbook expects, each with when
  it is right, how, and what it costs. Source them from the README's "Variant",
  "Extending" and "Alternatives" sections. **Nobody asks for a variant they do
  not know exists**, so these get offered unprompted. A variation with no cost is
  the default in hiding.
- **`## What should not change`**: what must stay true however far it is adapted,
  each with the concrete symptom if it is violated. Source them from the README's
  "Why <x> is not optional" sections, which were prose no skill could act on. This
  is what the installer argues back with; an operator who still wants it after
  hearing what breaks gets it, recorded.
- **`## Done when`**: the acceptance test, one checkable line each. This is what a
  fresh-workspace run walks to earn `approval.demoWorkspace`.

**The frontmatter is the standard skill frontmatter and nothing else** (`name`,
`description`, `version`, `compatibility`, `homepage`, `metadata`). `SKILL.md`
is customer-facing: `skills add` installs it and an agent loads it, so Cargo's own
bookkeeping stays out. State, approval evidence and chain position live in
`cargo.scaffold.json` beside `requires` and `kind`, which the CLI reads and never
copies. The one thing a customer should see is the honest banner at the top of
the body, `**State: to-be-approved.**`, and the validator requires it exactly
while the manifest says so and refuses it once approved. **Quote any frontmatter
value containing a colon-space.**
Unquoted, YAML reads it as a nested mapping and `npx skills add` skips the whole
file with a warning nobody reads. The validator catches it now; it did not on day
one.

The `description` follows the four-part template from cargo-skills'
`CONTRIBUTING.md` (job → literal quoted triggers → proper nouns → `Skip when:`),
because that is the only text an agent weighs before loading a skill. **Every
`Skip when:` has the same job here: pin the one-off vs standing seam.** "Build me
a TAM" belongs to `cargo-gtm` when someone wants a list today and to
`tam-building` when they want a pipeline that keeps it current. Get that wrong
and a user installs a CDK project to answer a question that wanted one turn.

Do not restate the install procedure in a cookbook's `SKILL.md`. Get the code in,
adapt, plan, deploy, verify is identical for all of them and lives once, in
[`deploy-cookbook/SKILL.md`](deploy-cookbook/SKILL.md).

There used to be a second file, `cookbook.json`, carrying the same contract as
data. It was folded into `SKILL.md` on 2026-08-18: every reader of the contract
is an agent, and agents read markdown, so the JSON was a second authored copy for
a consumer that did not exist.

## Every resource must earn its deploy

A cookbook combines 3+ resource types, but that is a description of what real
outcomes need, **not a quota to fill**. A resource nobody calls is not
completeness, it is weight: it deploys, it shows up in the workspace, and it
rots. Three rules learned the hard way:

- **Do not wrap a single connector action in a tool.** If the workflow body is
  one `uses.<connector>.<action>(...)` call and a return, there is no tool: there
  is an action, and the user can call it from the CLI without deploying anything:

  ```sh
  cargo-ai orchestration action execute --wait-until-finished \
    --action '{"kind":"connector","integrationSlug":"<slug>","actionSlug":"<slug>","config":{}}' \
    --data '{...}'
  ```

  A tool earns its place when it composes several steps, or when something else
  (an agent, an MCP server, a CRM button) needs to call it by handle.

- **Segments should view outputs, not restate inputs.** A segment that repeats a
  play's own trigger filter is dead weight and a drift trap: change one, forget
  the other. A segment that shows what the automation **produced** (the deals it
  flagged, the accounts it sourced) is the thing a human actually opens.

- **Do not map a value into a column of the wrong type** just to fill it. A range
  string ("51-200") written into a numeric column gives you a column that is
  silently empty or wrong, which is worse than an empty one.

## Conventions

- Mark values that must be edited before deploy with a `PLACEHOLDER` comment
  (API keys via env, channel IDs, member uuids, persona filters), **and give each
  one a row under `## What you will be asked` in the cookbook's `SKILL.md`**. The
  comment is for whoever reads the code; the row is what lets an agent resolve it
  instead of guessing.
- Read secrets with `secret("NAME")` and document the env var in `.env.example`.
- Keep `defineContext` paths root-relative — resources are loaded from the
  project root.
- App/worker bundles under `*/apps/*` and `*/workers/*` are self-contained
  sub-projects (own `tsconfig` + deps) and are excluded from the root project.
