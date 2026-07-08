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

| Command                | What it does                                         |
| ---------------------- | ---------------------------------------------------- |
| `npm run validate`     | `cargo.scaffold.json` matches the folders on disk    |
| `npm run typecheck`    | `tsc --noEmit` (needs generated types — run locally) |
| `npm run format`       | Prettier write                                       |
| `npm run format:check` | Prettier check                                       |
| `npm run plan`         | dry-run the resource graph against your workspace    |

CI runs `npm run validate` and `npm run typecheck`: both work without a live workspace.
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
  (API keys via env, channel IDs, member uuids, persona filters).
- Read secrets with `secret("NAME")` and document the env var in `.env.example`.
- Keep `defineContext` paths root-relative — resources are loaded from the
  project root.
- App/worker bundles under `*/apps/*` and `*/workers/*` are self-contained
  sub-projects (own `tsconfig` + deps) and are excluded from the root project.
