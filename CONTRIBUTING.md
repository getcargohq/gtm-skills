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

| Command                    | What it does                                               |
| -------------------------- | ---------------------------------------------------------- |
| `npm run validate`         | the scaffold graph, the skill layer, and the routing evals |
| `npm run validate:routing` | cookbook descriptions graded against cargo-skills' 17      |
| `npm run typecheck`        | `tsc --noEmit` (needs generated types — run locally)       |
| `npm run format`           | Prettier write                                             |
| `npm run format:check`     | Prettier check                                             |
| `npm run plan`             | dry-run the resource graph against your workspace          |

CI runs `npm run validate` and `npm run typecheck`: both work without a live workspace.
The routing evals inside `validate` need a `cargo-skills` checkout beside this repo and
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
   cookbooks it imports from, `base-gtm` at minimum). `npm run validate` enforces
   this.
6. Add a row to the Cookbooks table in the root `README.md`.
7. Add a `cookbook.json` (see below). `npm run validate` reports every folder
   that still lacks one.
8. If it is an outcome cookbook, add a `SKILL.md` and at least one routing eval
   case in `evals/routing.jsonl`.

## cookbook.json and SKILL.md

A cookbook that is only code is not installable: the README says the
placeholders in prose, and whoever installs it has to read that prose and guess.
Two files fix that, and `scripts/check-cookbooks.mjs` gates both.

**`cookbook.json` is the contract** ([`cookbook.schema.json`](cookbook.schema.json)).
The code in a cookbook is a **worked example**, not a template with holes in it:
whoever installs it should end up with the code their company would have
written. So the file says which parts may be reshaped and which may not:

- **`invariants`** — what must stay true however far it is adapted, each with the
  concrete `whatBreaks` symptom. This is what the installer argues back with when
  an operator asks for something that will quietly fail. Source them from the
  README's "Why <x> is not optional" sections, which were prose no skill could
  act on.
- **`variations`** — the reshapes this cookbook expects, each with `when`, `how`,
  and the `trade` it makes. Source them from the README's "Variant", "Extending"
  and "Alternatives" sections. **Nobody asks for a variant they do not know
  exists**, so these get offered unprompted. A variation with no `trade` is the
  default in hiding, and the validator rejects it.
- **`inputs`** — the floor: the questions that must be answered whichever shape
  the operator lands on.
- **`decisions`** — written by the installer into the _scaffolded copy_, never
  into this repo (the validator refuses the key here). It records what this
  deployment adapted and why, which is the only thing that explains, six months
  later, why their code diverges from the cookbook it came from.

Plus what this produces, how you know it worked, what it costs, and whether it is
approved. The installer skill reads it,
the validator checks it, and the UI deployment surface renders its `inputs` as
fields. It deliberately carries **no `requires` key**: the dependency graph lives
once, in `cargo.scaffold.json`.

Write `inputs` so that **derive comes before ask**. An input carrying a `derive`
is a lookup, not a question: which connector is already authenticated, what the
CRM schema contains, how many closed-won rows there are. If more than about four
inputs have no `derive`, the interview is too long and most of them should have
been lookups. Every input needs a `why`, which is what you say when the operator
pushes back on the question.

**`SKILL.md` is the discovery surface**, and only outcome cookbooks have one.
`base-gtm` and `crm-sync` are `kind: foundation`: they define no motion of their
own, so a skill for them would compete for prompts it cannot serve, and the
validator refuses one.

The `description` follows the four-part template from cargo-skills'
`CONTRIBUTING.md` (job → literal quoted triggers → proper nouns → `Skip when:`),
because that is the only text an agent weighs before loading a skill. **Every
`Skip when:` has the same job here: pin the one-off vs standing seam.** "Build me
a TAM" belongs to `cargo-gtm` when someone wants a list today and to
`tam-building` when they want a pipeline that keeps it current. Get that wrong
and a user installs a CDK project to answer a question that wanted one turn.

Do not restate the install procedure in a cookbook's `SKILL.md`. Scaffold, fit,
deploy, verify is identical for all of them and lives once, in
[`deploy-cookbook/SKILL.md`](deploy-cookbook/SKILL.md).

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
  one an entry in `cookbook.json` `inputs`**. The comment is for whoever reads the
  code; the entry is what lets an agent, the CLI, or the UI actually resolve it.
- Read secrets with `secret("NAME")` and document the env var in `.env.example`.
- Keep `defineContext` paths root-relative — resources are loaded from the
  project root.
- App/worker bundles under `*/apps/*` and `*/workers/*` are self-contained
  sub-projects (own `tsconfig` + deps) and are excluded from the root project.
