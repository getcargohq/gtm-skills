# Fork, install and release

## Two repositories have different jobs

Fork `getcargohq/gtm-skills` to customize this pipeline. The distribution contains
many independent pipelines, so do not deploy from its root. Create a separate
Manifest project for the company's context, website and workspace state with
the installed `cargo-ai cdk init` command. Put that project in the company's own
GitHub repository. The hosted maintainer must target this consuming repository.

For the upstream version after merge, use `cargo-ai cdk add cookbook/company-website`
inside the company project. For a local fork or PR revision, run this **from the
distribution checkout** after inspecting the revision:

```sh
node company-website/scripts/install.mjs --project /absolute/path/to/company-project
```

This local copy is useful because the registry currently fetches upstream main.
It follows the CDK installer layout, skips existing files, and never changes the
company project's root package, state, CI or git remote. Review the written and
skipped lists. A repeated installation preserves edits; updates to previously
installed files require a reviewed diff, not a blind overwrite. Record the fork
URL and source commit in the company's installation output.

All subsequent commands below run from the **company project root**. Use the
project's installed CLI and inspect `--help` before adapting command flags.

## Bind the company project

1. Read the actual CDK root and state path from the project. The normal layout
   uses `infra/`; if different, pass the same `--cdk-dir` to helper commands.
2. Read `cargo-ai whoami`, git origin and GitHub's default branch. Update
   `infra/company-website/website.json` with these values. Leave `publish` false.
   Choose a unique public app slug before first release and keep it stable after.
3. Inspect authenticated connectors. The worked resources adopt one default
   GitHub connector and one default Anthropic connector. Reuse existing project
   handles if declared already, adapting the corresponding helper check too.
   Confirm repository access and the selected model's availability. OAuth is
   granted through Cargo's connection flow, not created by the resource file.
4. For website-only operation, set `maintainer: false` before the first deploy.
   Setting it false after deployment requests resource deletion in the plan.
5. Run `npm ci --prefix infra/company-website/apps/website`, then:

```sh
node scripts/company-website/website.mjs check
node scripts/company-website/website.mjs doctor
```

`doctor` performs reads and prints the verified workspace URL. `check` performs
an offline app build and CDK graph check; it does not authenticate or publish.
The browser package has its own TypeScript config. If the parent project has a
broad TypeScript include, exclude `infra/company-website/apps/website/**` there
and run its check separately, as the helper does.

## Preserve state

For an existing project, retain its CLI-generated `cargo.state.json` binding.
For a newly initialized project, use the installed CLI's supported state flow
and commit the generated pointer if required by that project. Current commands
include `cargo-ai cdk state create --dir infra` for a genuinely new state and
`cargo-ai cdk state bind <uuid> --dir infra` to recover a known existing binding.
Verify both with `--help`; never write state JSON by hand or use `--force` to
resolve an update problem.

If a deployed state pointer is missing, restore it from git or recover the
known workspace-held state. Creating fresh state can orphan resources and make
the next plan look like a new installation. Do not copy a state pointer when
creating a project for another workspace. Start that workspace's project with
its own CLI initialization, and keep the earlier project and state intact.

Run `node scripts/company-website/website.mjs plan` against the same CDK root.
It checks target identity and refuses an absent binding. Inspect all resources
in the resulting plan, including unrelated deletions and connector adoption.
The native CDK also validates workspace ownership at deployment. The helper's
guards are additional checks, not a replacement deployment engine.

## Integrate with the existing release workflow

Adapt the company's existing checks and production deployment; this pipeline
does not ship a second competing deploy workflow. Before enabling publication,
show a concrete PR with these changes and the local preview:

- PR checks run a clean app install, the helper's `check`, browser tests where
  available, and the project's required lint/type checks. Include the website
  app, resource and script paths in any workflow path filters.
- Online plans use the project's permitted read credentials. Untrusted fork PRs
  must not receive production secrets; run their offline checks first.
- The release job uses the existing protected environment and approved branch.
  Run `doctor`, `check` and `plan` for the same commit and state before the
  project's supported deploy command. Fail the release if a check fails. Do not
  execute local production deploys where repository rules reserve them for CI.
- Give the hosted maintainer access to prepare PRs in the consuming repository.
  Keep release credentials in protected CI and require review for workflow,
  state and target changes. A system prompt cannot enforce GitHub permissions.
- Avoid concurrent releases of the same state. Confirm the commit being released
  is still the intended approved revision; preserve the prior successful app
  deployment and source commit in the release record.
- Once publication is approved, set `publish: true`, replace draft content and
  set its status to `ready`. The app declaration then appears in the plan and
  Cargo builds and promotes it during the authorized release.
- After deployment, run `node scripts/company-website/website.mjs verify`.
  Archive its returned app/workspace URLs, deployment ID and source match, then
  run the browser and form checks on that actual public URL.

The helper exposes no deploy, merge or state-writing command. The CLI command
details belong to the Cargo project and hosting skills; update those mechanics
from installed help instead of freezing a copied deployment implementation here.

## Update or recover

For a normal update, keep the app slug and state pointer, edit the existing app,
review its source-hash update in the plan, and release through the same workflow.
The maintainer should update an existing request's PR on retry.

If a release fails, inspect Cargo's deployment status/logs with the hosting skill
and verify what is actually promoted before reporting availability. For recovery,
prepare a PR restoring the last known-good app source and lockfile, review the
plan and release through the same CI. Direct promotion of an earlier deployment
is an alternative only if the installed CLI supports it and the operator has
authorized it. Do not invent a rollback command or replace deployment state.

If the source marker reports a different revision, the HTTP check has not proved
this release. Check promotion and caches; do not mark the release complete.
