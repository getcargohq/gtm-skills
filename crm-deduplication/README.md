# CRM deduplication

Keep CRM accounts and contacts duplicate-free without creating second account or contact models.
This folder is a worked example: copy it into a Cargo CDK project as a sibling, reconcile its CRM
models and connector with compatible resources already in the project, adapt `infra/index.ts`, and
follow the approval gates before deploying or running the disabled plays.

The agent first audits live CRM account and contact identity coverage and candidate classes. After
the operator approves matching keys, survivor precedence, automatic-merge classes, low-confidence
review behavior, and manual-review destination, it builds `deduplicate_accounts` directly on the CRM
account model and `deduplicate_contacts` directly on the CRM contact model. Each run searches the
live CRM, normalizes and scores duplicate evidence, selects a deterministic survivor, then merges
only the approved high-confidence classes or pauses for Cargo's native Human Review. Approval
merges; decline, timeout, or review-disabled low-confidence contact groups leave records separate.

The contact path also stores approved non-empty people identity values before a guarded merge and
writes them back to the canonical Contact after the native CRM merge. That write-back is limited to
email, phone, LinkedIn URL, LinkedIn person ID, job title, and primary associated company ID.
The checked contact graph prepares four LinkedIn URL search variants before live CRM search so
runtime `findRecords` matches the audit's normalized URL comparisons. Phone formatting cannot be
exhaustively searched the same way; use a priced, operator-approved CRM normalization write policy
before rerunning rows where phone-only duplicate coverage matters.

Contact high-confidence groups include transitive chains across exact approved keys: if A matches B
on LinkedIn person ID and B matches C on normalized LinkedIn URL without conflicts, all three merge
into one canonical Contact without reselecting between secondary merges.

The checked example is HubSpot. Salesforce and Attio adapt the same file. Both plays are disabled,
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
