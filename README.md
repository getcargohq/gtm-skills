# Cargo CDK cookbooks

Each cookbook is a folder of `define*` resources that combine 3+ CDK resource
types into one applyable outcome. They compose by sitting in the same project
root: every cookbook builds on `base-gtm` (the shared accounts/contacts
schema and connector set), so two cookbooks never collide and their resources
stack.

## Using a cookbook

**With an agent** (it asks you the handful of things only you know, then deploys
and verifies):

```sh
npx skills add getcargohq/cargo-cookbooks/deploy-cookbook
npx skills add getcargohq/cargo-cookbooks/tam-building
```

Every outcome cookbook carries a `SKILL.md`: what it produces, what you will be
asked, what you can change, what should not change, and how you know it worked.
The install procedure is identical for all of them and lives once, in
[`deploy-cookbook/`](deploy-cookbook/SKILL.md).

**The code in a cookbook is a worked example, not a template to fill in.** The
agent installing it adapts it until it is your company's code, and records what
it changed and why.

**By hand, into an empty directory.** Scaffold one directly:

```sh
cargo-ai cdk init my-tam --from getcargohq/cargo-cookbooks/tam-building
```

`--from` reads `cargo.scaffold.json` and pulls the cookbook plus its required
siblings (`base-gtm`, transitively) and the shared root files, keeping the
folder layout so cross-folder imports resolve.

**By hand, into a project that already exists:**

```sh
cargo-ai manifest add tam-building --dir .     # a plain CDK project
cargo-ai manifest add tam-building             # a Manifest repo (infra/, the default)
```

Copy-in: required siblings come along, files that already exist are kept, and
every installed file's source, ref and hash lands in `manifest.json`. **Never
`cdk init --force` into a non-empty directory**: it replaces `package.json` and
reverts any cookbook code you have adapted.

Or manually: keep `base-gtm/` plus the cookbook folders you want; delete the
rest. Then:

```sh
npm install            # postinstall syncs types if you are logged in (optional)
cp .env.example .env   # fill in the secrets the cookbooks you deploy need
cargo-ai cdk plan      # dry run: review the resource graph
cargo-ai cdk deploy
```

Run from this directory — `defineContext` paths are root-relative.

## Approval state

Every cookbook is **to be approved** until it has been tested in a fresh demo
workspace **and** implemented by two customers or partners. That state lives in
each `SKILL.md`'s frontmatter, and `npm run validate` refuses an `approved`
cookbook that cannot show both. Cargo makes no public outcome claim for a cookbook that is not
approved, and at the time of writing none of them is.

## Conventions

- **Placeholders** are marked `PLACEHOLDER` in code comments — edit them before
  deploying (API keys via env, channel IDs, member uuids, persona filters) — and
  each one has a row under `## What you will be asked` in the cookbook's
  `SKILL.md`, which is what lets an agent resolve it instead of guessing.
- **Shared resources** (Slack, LinkedIn, waterfall, Cargo-DB and LLM connectors,
  the accounts/contacts models, folders) live in `base-gtm`: cookbooks import
  handles from there and never redefine them. The **CRM** connector is the one
  exception: it lives in `crm-sync`, so a cookbook that never touches a CRM does
  not inherit a credential it has no use for.
- Each cookbook's README states its resource graph, placeholders, and a
  "done when" check.

## Cookbooks

The `Requires` column is the source of truth in `cargo.scaffold.json` and is
enforced by `npm run validate`.

| Folder                   | Outcome                                                            | Requires                                      |
| ------------------------ | ------------------------------------------------------------------ | --------------------------------------------- |
| `base-gtm/`              | shared foundation: native accounts/contacts + credits connectors   | —                                             |
| `crm-sync/`              | the CRM slot: the only cookbook that needs a CRM credential        | `base-gtm`                                    |
| `tam-building/`          | Sales Nav company search, split past the 1,000 cap → `accounts`    | `base-gtm`                                    |
| `list-building/`         | Sales Nav people search, split past the 2,500 cap → `contacts`     | `base-gtm`                                    |
| `signal-based-tam/`      | signals over the TAM → living SAM + outreach play                  | `base-gtm`                                    |
| `inbound-flow/`          | form intake → verify → enrich → qualify → route + alert            | `base-gtm`, `crm-sync`                        |
| `contact-sourcing/`      | per SAM account: Cargo DB prospects → waterfall verify → CRM       | `base-gtm`, `crm-sync`                        |
| `routing-engine/`        | territories + capacity + territory-stamping play                   | `base-gtm`, `crm-sync`                        |
| `account-scoring/`       | native scoring play + tier segments, criteria as code              | `base-gtm`, `crm-sync`, `gtm-knowledge-graph` |
| `auto-enrichment/`       | nightly waterfall freshness crons for accounts + contacts          | `base-gtm`, `crm-sync`                        |
| `crm-button/`            | run a Cargo tool from any CRM record, result written back          | `base-gtm`, `crm-sync`                        |
| `meeting-prep/`          | a briefing card in Slack before every intro call, deduped          | `base-gtm`, `crm-sync`                        |
| `pipeline-health/`       | agent flags at-risk deals with the rule + the fix, weekly digest   | `base-gtm`                                    |
| `closed-won-multiplier/` | every won deal → net-new lookalike accounts, deduped and traceable | `base-gtm`, `pipeline-health`                 |
| `gtm-knowledge-graph/`   | the context repo as code + knowledge file + Q&A analyst            | `base-gtm`                                    |
| `research-agent/`        | account → enriched brief via agent + context + tools               | `base-gtm`, `gtm-knowledge-graph`             |
| `mcp-copilot/`           | the GTM stack behind one MCP endpoint                              | `research-agent`                              |
| `ai-sdr/`                | sourcing + research + copywriter → reviewed outreach drafts        | `contact-sourcing`, `research-agent`          |
| `plg-motion/`            | product events → PQL occurrence threshold → sales handoff          | `base-gtm`, `crm-sync`                        |
| `rep-cockpit/`           | hosted app: each rep's scored, routed book + drafts + next actions | `account-scoring`, `routing-engine`, `ai-sdr` |

## Already in Cargo: install these, do not build them

Two outcomes on the cookbook menu are **prebuilt template plays in the Cargo
template gallery**, not CDK code. Writing them here would be reinventing
something you can install in a minute.

| Outcome               | Where                                                                                                                                                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deduplication**     | Four template plays: companies and contacts, HubSpot and Salesforce. Search "dedu" in the template gallery, install the one matching your CRM and object, configure the matching keys and survivor rules, run.                                                                   |
| **Account hierarchy** | Template play "List subsidiary and sisters companies of an account" (Salesforce + OpenAI + LinkedIn). Enriches the domain, works out whether the account is a parent, researches related entities, updates the account. Add a custom column mapping child / parent / standalone. |

## Zero configuration by default

`base-gtm` deploys with **no credential and no environment variable**: its
`accounts` and `contacts` models are native (workspace-owned). A CRM key is
needed only when you install `crm-sync` or a cookbook that requires it.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for local setup, checks, and how to add
a cookbook.

> **Status: unverified.** These cookbooks typecheck against the CDK and their
> scaffold graph validates, but they have **not** been `cargo-ai cdk plan`-ed or
> deployed against a live workspace yet. Treat the "Done when" section of each
> README as the acceptance test that still has to be run.
