# CRM enrichment

Keep CRM accounts filled and refresh them when they go stale. This folder is a
worked example: copy it into a Cargo CDK project as a sibling, reconcile it with
what is already there, adapt `infra/index.ts`, and stop at
`cargo-ai cdk plan`.

The play fills approved blank identity and size fields from LinkedIn, writes
freshness only after a real fill, and re-enrolls a record after six months. It
runs on `crm_accounts` — the CRM account extract — and writes back with that
row's CRM record id. The checked example is HubSpot; Salesforce and Attio adapt
that one file. Nothing in this folder deploys or touches customer data by
itself.

`SKILL.md` is the procedure. Supporting depth:

| Path                      | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `SKILL.md`                | Outcome, install, contract, cost                   |
| `infra/index.ts`          | The only adaptation surface                        |
| `references/audit.md`     | Audit JSON contract and live-price preview         |
| `references/configure.md` | Model, mappings, and Salesforce / Attio adaptation |
| `references/run.md`       | Workflow / play boundary and consumer verification |
| `evals/acceptance.md`     | Acceptance checklist                               |

Do not declare a standalone segment. The play's filter is its managed backing
segment.
