# Account enrichment cookbook

This cookbook gives an agent one CDK file to adapt after auditing the consumer workspace:

`cdk/play/account-enrichment.ts`

The checked example is HubSpot-shaped. It contains the CRM Account model, native Account
unification, reusable enrichment tool, and disabled enrichment play in one place. When invoked,
the agent rewrites the CRM-specific connector, model columns, write action, fill-blank guard, and
field destinations from the live workspace. The repository does not maintain parallel HubSpot,
Salesforce, and Attio copies.

```mermaid
flowchart LR
  audit[Audit live CRM] --> adapt[Edit one CDK file]
  adapt --> check[CDK check and plan]
  check --> pilot[Disabled 15-row pilot]
```

| Path                             | Purpose                                      |
| -------------------------------- | -------------------------------------------- |
| `SKILL.md`                       | Cookbook router and non-negotiable contracts |
| `skills/`                        | Audit, model, mapping, and run instructions  |
| `cdk/play/account-enrichment.ts` | The only agent-edited CDK template           |
| `evals/acceptance.md`            | Acceptance criteria                          |
| `examples/example.md`            | Worked adaptation                            |

The play targets the concrete CRM model because CRM write actions require a real CRM record ID.
That model feeds Cargo's native Account unification for downstream use. The global Account ID is
never sent back to a CRM action.

Do not declare a standalone segment. The play's filter is its managed backing segment. Nothing in
this cookbook deploys resources or accesses customer data by itself.
