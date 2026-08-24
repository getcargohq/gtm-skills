# Account enrichment cookbook

Turn incomplete CRM company records into a unified, continuously refreshed Account foundation.
This cookbook helps an agent:

- audit duplicate properties and missing company identifiers
- choose primary CRM fields from live fill rates and compatible types
- connect the CRM Account model to Cargo's global Account identity
- populate approved matching keys and firmographics without overwriting existing values
- track enrichment status and freshness
- keep coverage current by evaluating newly eligible segment rows every day

The result is a reviewed, disabled 15-row pilot with exact target counts, credit estimates, and
field mappings. Nothing deploys, calls a paid provider, or writes customer data from this
repository.

After the outcome and mappings are approved, the agent adapts one infrastructure template:
`infra/account-enrichment.ts`. The checked source is HubSpot-shaped and contains the CRM Account
model, native Account unification, reusable enrichment tool, and disabled play. For Salesforce or
Attio, the agent replaces the connector, extractor, write action, fill-blank guard, and field
destinations from live generated types. The repository does not maintain parallel CRM copies.

```mermaid
flowchart LR
  audit[Audit live CRM] --> unify[Unify Account identity]
  unify --> approve[Approve fields and cost]
  approve --> adapt[Adapt one infrastructure file]
  adapt --> check[CDK check and plan]
  check --> pilot[Disabled 15-row pilot]
```

| Path                          | Purpose                                       |
| ----------------------------- | --------------------------------------------- |
| `SKILL.md`                    | Cookbook router and non-negotiable contracts  |
| `references/`                 | Audit, model, mapping, and run instructions   |
| `infra/account-enrichment.ts` | The only agent-edited infrastructure template |
| `evals/acceptance.md`         | Acceptance criteria                           |
| `examples/example.md`         | Worked adaptation                             |

The play targets the concrete CRM model because CRM write actions require a real CRM record ID.
That model feeds Cargo's native Account unification for downstream use. The global Account ID is
never sent back to a CRM action.

Do not declare a standalone segment. The play's filter is its managed backing segment. Nothing in
this cookbook deploys resources or accesses customer data by itself.
