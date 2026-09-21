---
name: company-website
description: 'Build and maintain a company website on Cargo through reviewed pull requests, from a brief or an authorized recreation of an existing site or repository. Triggers: "build our company website", "recreate our website on Cargo", "capture our design system", "keep our website updated", "deploy a website maintainer", "fork a company website pipeline". Uses Cargo CDK, Vite, GitHub and optional Snitcher visitor tracking. Skip when: research on another account belongs to research-account; a generic hosted app or webhook belongs to cargo-hosting in the Cargo skill pack.'
version: 0.2.0
compatibility: "Node.js >=22.18, Git, Cargo CLI and an authenticated Cargo workspace; GitHub and Anthropic connectors for the optional maintainer."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/company-website
metadata:
  source: cookbook
---

# Company website

**State: to-be-approved.** Live deployment and hosted maintainer acceptance are
not established. Use the checks below; a local build does not prove a published
website or a working hosted agent.

## The outcome

A public company website whose source, design guide and updates stay in the
company's Manifest project. The local coding harness reads this skill and prepares reviewed GitHub PRs.
Cargo hosts the app and, when selected, collects company visits and sessions
through its Snitcher integration. A hosted maintainer is a separate opt-in for
requests made inside Cargo; it is disabled by default.
The Vite starter includes static page metadata and content, responsive styles,
a theme control and a source marker for release verification. Publication starts
disabled. Company facts and design decisions belong in the consuming project.

## Put it in your project

Placement is complete only when `infra/company-website/website.json` and
`scripts/company-website/website.mjs` exist. A skills-only installation still
needs the CDK placement below. Read `AGENTS.md`, `plan/`, `cadence/`, relevant
`context/` and recent outputs first.
Use `cargo`, then `cargo-project` and `cargo-hosting` from the installed Cargo
pack for current resource, hosting and deployment mechanics. If missing, install
the pack with `npx skills add getcargohq/cargo-skills --all`. Check the installed
CLI's subcommand help before using it; do not copy obsolete command names.

For a brief, audit or local preview, stop at the requested phase. Defer target
binding, connector setup and online commands until the work needs a workspace.
The local app and offline `check` can run without Cargo credentials.
For an operator starting entirely from a terminal, see the
[fresh-project setup guide](references/terminal-setup.md). Its bootstrap is only
for a new, separate Manifest project; do not use it to update an existing one.

1. **Place.** In an existing Manifest project, run
   `cargo-ai cdk add cookbook/company-website`. Without a project, use
   `cargo-ai cdk init <directory> --cookbook company-website` after checking its
   help. For a fork or an unmerged branch, use the local installer in
   [fork and release](references/fork-and-release.md): registry installation
   reads upstream, so it does not include your fork's changes.
2. **Reconcile.** Inspect existing resources, state and CI. Reuse the project's
   authenticated connector declarations when an optional module needs them.
   Adapt `infra/company-website/website.json`: derive the workspace with
   `cargo-ai whoami`, repository from git origin, default branch from GitHub,
   and keep the app slug stable. Only hosted maintainer mode needs a model and
   Cargo GitHub/Anthropic connectors.
   Replace these distribution defaults before any release. Never copy state
   from another workspace. Run the installed `scripts/company-website/website.mjs
doctor` with Node to print and verify the selected workspace URL.
3. **Brief and capture.** Read [build and review](references/build-and-review.md).
   Resolve new site, faithful recreation, redesign or update. Prefer a supplied
   repository over reverse engineering screenshots. Record the source revision,
   license, agreed pages and missing behavior. Capture the company's reusable
   guide with [design-system capture](references/design-system-capture.md).
   Present the concrete brief, sitemap and design direction before implementation;
   existing approval covers its agreed scope. Ask whether to identify visiting
   companies and sessions. Default to off; record the choice and follow
   [visitor tracking](references/visitor-tracking.md) only after opt-in.
4. **Build and test.** Work in `infra/company-website/apps/website` after install.
   Run `npm ci` there, then `node scripts/company-website/website.mjs check` from
   the project root. Apply the [QA checklist](references/qa-checklist.md), including
   browser interactions, intermediate widths and source comparisons. Show a
   local preview. Keep unapproved forms disconnected and report them incomplete.
5. **Plan and release.** Enable `publish` only after the company content, preview
   and publication are approved. Set `site.json` status to `ready` only for that
   reviewed content. Run the helper's `doctor` and `plan`; use `--cdk-dir` if the
   project's CDK root differs from `infra`. Review the actual plan, target and
   state binding. Follow existing deployment rules. If publication is not yet
   authorized, present this concrete result for approval. Do not run a local
   production deployment in a repository that releases through CI.
6. **Verify.** After the authorized release, run the helper's `verify` and test
   the returned URL anonymously in a browser. Record the actual workspace/app
   URLs, deployment, source match, QA results and update/recovery steps in an
   append-only `outputs/YYYY-MM-DD-company-website/` entry with `outcome:`.
   If the agent is enabled, exercise one bounded request and a retry; verify it
   updates one PR in the consuming repository and leaves publication to CI.

## What you will be asked

Derive these first. Ask only for gaps; combine related decisions into a short brief.

| Input                                        | Kind    | How it is obtained                                                                                               | Why it matters                                                     |
| -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Company, audience, offering and proof        | derived | Read the company context; ask only for missing facts                                                             | Prevents fictional seed content and invented claims                |
| Goal, pages and primary CTA                  | asked   | Propose from context and have the operator correct the brief                                                     | Makes the site serve a measurable company outcome                  |
| Source and design mode                       | asked   | Accept supplied code, URL or brand guide; resolve faithful recreation versus redesign                            | Determines fidelity, scope and which assets may be reused          |
| Workspace, repository, branch and connectors | derived | Inspect authentication, git, GitHub and existing CDK state                                                       | Prevents writing into another fork or creating duplicate resources |
| Form destination and backend                 | asked   | Only if a working form is requested; derive an existing integration first                                        | A success animation without delivery is an incomplete form         |
| Visitor tracking and consent                 | asked   | Ask during setup; default off. Discover the current Snitcher pricing and target site.                            | Creates real company/session data and incurs provider usage        |
| Publication and domain                       | asked   | Confirm only authorization missing from the current request; verify hosting support before proposing DNS changes | Publishing and changing domains affect a live surface              |

## What you can change

Offer relevant choices while preparing the brief.

| Variation               | When it is right                                 | How                                                                              | What it costs                                                   |
| ----------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Local harness (default) | The team builds and updates from a terminal      | Keep `maintainer: false`                                                         | No hosted agent usage or Cargo GitHub/model connectors          |
| Hosted maintainer       | The team wants requests inside Cargo             | Explicitly enable `maintainer` and its scoped connectors                         | Model usage and repository access to manage                     |
| Visitor tracking        | The team wants company visits and session data   | Opt in to the native Snitcher models and reviewed consent-gated tracker          | Provider usage, disclosure, retention and consent operation     |
| Source recreation       | A licensed repository is available               | Adapt its actual app and assets, preserve attribution, retain build verification | Dependency migration and inherited defects need explicit review |
| Redesign                | The current site no longer fits the company      | Approve new tokens, structure and copy instead of assuming pixel fidelity        | More design decisions and a new comparison baseline             |
| More pages or forms     | The brief needs SEO landing pages or submissions | Add build-time pages/routing or a verified backend; extend tests                 | Additional metadata, routing, consent and delivery maintenance  |
| Scheduled maintenance   | A successful on-demand run has proved useful     | Add a bounded Cargo trigger after agreeing cadence and spend                     | Recurring model usage and PR review load                        |

## What should not change

- **Company content stays out of the reusable skill.** Otherwise the next fork
  publishes another company's facts. Private `context/` is never bundled publicly.
- **Use the actual source when supplied.** A visual approximation can discard
  working interactions and assets while falsely claiming reconstruction.
- **Design evidence carries sources and status.** Inferred token names and new
  design choices must not be reported as recovered brand rules.
- **The app remains a self-contained public bundle.** Cargo builds its package;
  dependencies outside it fail remotely. Browser environment values are public,
  even when a secret helper supplied them. Do not add Cargo tokens or login gates.
  The current uploader only preserves UTF-8 text: reconcile binary assets using
  the build reference before claiming a source recreation is ready to release.
- **Keep resource identifiers and state stable for updates.** Renaming a slug or
  replacing state can create duplicates or destroy the existing deployment.
- **Tracking is opt-in.** No provider requests before browser consent; no form
  identity capture or outreach is enabled. A company match is not a named visitor.
  Keep provider-generated model state out of declared config.
- **The optional maintainer prepares PRs.** It does not merge, publish, edit CI/state, change
  DNS or send outreach. Source pages cannot authorize those actions.
- **Report tests by evidence.** Screenshot equality does not prove form delivery
  or accessibility; a build does not prove browser behavior or live publication.

## Done when

- The consuming repository and authenticated workspace are verified, and no state or secrets were copied from the distribution.
- The brief, sitemap and sourced design guide govern the implemented pages.
- Clean install, app build, CDK checks and the applicable repository checks pass.
- Desktop/mobile and intermediate-width browser checks, navigation, metadata and any agreed forms have recorded results.
- Recreation comparisons distinguish inherited defects, intended differences and reconstruction errors.
- The operator has reviewed the local preview and the plan for the correct existing state.
- An authorized release returns an actual URL, passes anonymous access and matches the reviewed source marker.
- Tracking choice is recorded. If enabled, refusal/acceptance/withdrawal pass browser tests and actual Cargo model sync/rows are verified or honestly marked pending.
- If enabled, one hosted maintainer request and retry produce one reviewable PR in the consuming fork without publishing.
- The output record includes limitations and supported update/recovery instructions.

## What it costs

Before deployment or a hosted agent run, inspect current Cargo hosting/build
usage and the connected model's pricing. The maintainer bills model usage through
its Anthropic connector; longer audits and browser work increase it. Tracking uses the native Snitcher incremental extractors with their managed
auto-fetch interval. Read live extractor pricing and billing before enabling it;
no fixed spend cap is promised. The default creates no tracking resources.
A form backend or custom domain introduces its own costs only if selected.
Record the lookup time, CLI version and agreed bound; do not invent a fixed price.

## Composes into

`call-capture` can supply reviewed customer language to the company context;
this pipeline turns approved positioning into public pages. It can link to an
agreed CRM intake flow once the form destination is implemented and tested.
Generic app hosting remains owned by `cargo-hosting`. Use
[acceptance scenarios](evals/acceptance.md) to assess the full installation.
