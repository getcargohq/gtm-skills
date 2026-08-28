# CRM deduplication

Keep CRM accounts duplicate-free without creating a second account model. This folder is a worked
example: copy it into a Cargo CDK project as a sibling, reconcile its CRM model and connector with
compatible resources already in the project, adapt `infra/index.ts`, and follow the approval gates
before deploying or running the disabled play.

The agent first audits live CRM account identity coverage and candidate classes. After the operator
approves the matching keys, survivor precedence, automatic-merge class, and manual-review
destination, it builds one `deduplicate_accounts` play directly on the CRM account model. Each run
searches the live CRM, normalizes and scores duplicate evidence, selects a deterministic survivor,
then merges the narrow automatic class or pauses for Cargo's native Human Review. Approval merges;
decline or timeout leaves the records separate.

The checked example is HubSpot. Salesforce and Attio adapt the same file. The play is disabled,
`noConcurrency`, and limited to 15 CRM rows. Nothing in this folder deploys, runs, or touches
customer data by itself.

This pipeline requires the `cargo-cdk` authoring skill:

```sh
npx skills add getcargohq/cargo-skills --skill cargo-cdk
```

`SKILL.md` is the procedure. Supporting depth:

| Path                      | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `SKILL.md`                | Outcome, installation, contracts, approvals, and cost     |
| `infra/index.ts`          | The only infrastructure adaptation surface                |
| `references/audit.md`     | Identity coverage, candidate classes, and survivor audit   |
| `references/configure.md` | CRM search, scoring, merge, and Human Review configuration |
| `references/run.md`       | Pilot approval, verification, reporting, and Cargo links   |
| `evals/acceptance.md`     | Acceptance checklist                                       |
| `evals/contract.mjs`      | Executable deduplication graph and safety contract         |

