# CRM deduplication

Keep CRM accounts and contacts duplicate-free without creating staging models. This folder is a worked
example: copy it into a Cargo CDK project as a sibling, reconcile its CRM model and connector with
compatible resources already in the project, adapt `infra/`, and follow the approval gates
before deploying or running the disabled play.

The agent first audits live CRM identity coverage and candidate classes. After the operator
approves the matching keys, survivor precedence, automatic-merge class, and manual-review
destination, it builds sibling `deduplicate_accounts` and `deduplicate_contacts` plays directly on
the CRM models. Each run searches the live CRM, normalizes and scores duplicate evidence, selects a
deterministic survivor, then merges a narrow automatic class or pauses for Cargo's native Human
Review. Approval merges; decline or timeout leaves the records separate.

Contact automatic merge accepts exact LinkedIn person ID, exact LinkedIn URL without person-ID
conflict, exact non-generic email without LinkedIn conflict, and conflict-free transitive chains of
those keys. A LinkedIn conflict, generic/shared email, or phone-only match always leaves the
automatic path. After a contact merge, approved writable values are sent to the new record ID
returned by HubSpot. Company associations are not written through the read-only
`associatedcompanyid` property.

The checked example is HubSpot. Salesforce and Attio adapt the same resources. Both plays are disabled,
`noConcurrency`, and limited to 15 CRM rows. Nothing in this folder deploys, runs, or touches
customer data by itself.

This pipeline requires the `cargo-cdk` authoring skill:

```sh
npx skills add getcargohq/cargo-skills --skill cargo-cdk
```

`SKILL.md` is the procedure. Supporting depth:

| Path                                  | Purpose                                                         |
| ------------------------------------- | --------------------------------------------------------------- |
| `SKILL.md`                            | Outcome, installation, contracts, approvals, and cost          |
| `infra/connectors/`                   | The uncached CRM slot and Slack review destination              |
| `infra/folders/`                      | Skill-owned model and play folders                              |
| `infra/models/`                       | CRM account and contact extracts                               |
| `infra/plays/`                        | Typed account and contact workflows and triggers                |
| `infra/scripts/policy.ts`             | Generic domains and account survivor precedence                 |
| `infra/scripts/evidence.ts`           | Typed account evidence script                                   |
| `infra/scripts/contact-*.ts`          | Typed contact search, evidence, and normalization scripts       |
| `references/audit.md`                 | Identity coverage, candidate classes, and survivor audit        |
| `references/configure.md`             | CRM search, scoring, merge, and Human Review configuration      |
| `references/run.md`                   | Pilot approval, verification, reporting, and Cargo links        |
| `evals/acceptance.md`                 | Acceptance checklist                                            |
| `evals/contract.mjs`                  | Executable account and contact graph and safety contract        |
