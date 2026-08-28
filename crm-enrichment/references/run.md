# Run

Adapt `infra/index.ts` after copying this folder into the consumer
project. The first plan is a disabled play and does not deploy from this
repository.

## Phase handoffs

Every message names the current phase and ends with `Next step`. A phase-boundary handoff contains
the evidence the operator needs, one concrete approval request, what approval unlocks, and what
remains blocked. An in-progress update says `No action needed` and names the next checkpoint.

After field-contract approval and explicit authorization to deploy disabled resources, deploy the
tool and the play with the play set to `isEnabled: false`. Resolve `workspaceUuid` from `cargo-ai whoami`
(`workspace.uuid`) and resolve resource UUIDs from `cargo.state.json` or the matching get/list
command. Send both clickable URLs:

- Play: `https://app.getcargo.io/workspaces/<workspaceUuid>/plays/<playUuid>`
- Tool: `https://app.getcargo.io/workspaces/<workspaceUuid>/tools/<toolUuid>`

Do not ask for phase-two approval when either deployed resource link is missing or does not resolve.
The same message includes the approved fields, eligible population, route counts, current unit
prices, and exact estimated credits. Its `Next step` asks the operator to review the disabled Cargo
resources and approve the run at that stated maximum cost. Until that approval, keep the play
disabled and make no paid enrichment call.

## Workflow and play boundary

`account_enrichment` is the reusable data component. Its workflow accepts a LinkedIn URL or handle
plus a domain, normalizes the LinkedIn value, calls one mutually exclusive provider route, and
returns the approved company-data schema. It has no CRM record id, CRM connector, fill-state policy,
or CRM write action.

`enrich_crm_account` is the play's per-row orchestration workflow. The checked example accepts the
CRM record id plus the current LinkedIn company ID, LinkedIn page, domain, name, website, and
employee count from that same `crm_accounts` row. The managed segment trigger has already enforced
identifier and freshness eligibility, so the workflow starts by calling `account_enrichment`, then
applies the approved per-field write policy and pushes the returned values to the CRM. HubSpot's
example matches `hs_object_id`. Salesforce matches `Id`. Attio matches the record id.

This is a compiled-node contract, not only a naming convention. `account_enrichment` starts with a
native Filter and contains the provider connector routes but no CRM connector node. The play starts
with one Tool node targeting `account_enrichment`, then runs the only CRM update. It contains no
provider connector node.

`enrich_accounts` is orchestration. It runs that workflow over `crm_accounts`
and owns its managed backing segment through `filter`. Do not declare a
separate segment. Do not introduce a native `accounts` unification to sit
between the play and the CRM write.

The tool output schema and the play write mappings form one interface: every selected provider field
returned by `account_enrichment` has its approved CRM destination in `enrich_crm_account`. The play
must invoke the tool handle instead of duplicating provider connector calls. If the interface
diverges, stop and reconcile it before sending either UI link.

A handle that already starts with `http` is used as the LinkedIn company URL.
Otherwise it is prefixed as `https://www.linkedin.com/company/<handle>`. Domain
is the fallback route.

The managed segment excludes rows without an identifier but includes populated stale rows. Do not
add a destination fill-state condition or repeat identifier and freshness conditions as workflow
branches. For each field, apply the approved `fill_blanks` or `refresh_selected` policy. Numeric zero
counts as populated. `cargo_last_enriched_at` and `cargo_enrichment_status: succeeded` write only
after the provider result and the CRM update.

Before every preview, run `cargo-ai connection integration get linkedin` and
read the applicable costs from
`integration.actions.enrichCompany.credits.costs` and
`integration.actions.enrichCompanyFromDomain.credits.costs`. Cost the eligible
CRM accounts with the current values and record when pricing was fetched.

## Verification

In this repository run `npm run validate`. In the consumer project:

1. Run `cargo-ai cdk types` after selecting the live CRM connector.
2. From the copied skill folder, run `node --import tsx evals/contract.mjs` after adapting
   `infra/index.ts`. It must pass before the plan is reviewed.
3. Run `cargo-ai cdk check`.
4. Run `cargo-ai cdk plan` and inspect every resource and action payload.
5. Confirm the plan has one CRM account model and no native `accounts` unification.
6. Confirm the compiled tool starts with a Filter and contains no CRM action. Confirm the play starts
   with one Tool node targeting `account_enrichment`, contains no provider action, and owns the only
   CRM update.
7. Deploy only after the phase-one approval explicitly authorizes disabled resource creation.
8. Show the operator direct Cargo UI links for the disabled play and tool, the approved field
   contract, exclusions, target counts, mappings, live action costs, exact estimated credits,
   pricing lookup time, and that the play stays disabled.
9. Run or enable only after the operator reviews that phase-two handoff and explicitly approves the
   stated population and maximum cost.

## Post-enrichment report

After the approved run completes, report:

- eligible, processed, written, and failed counts
- before-and-after filled counts and fill rates for every approved CRM destination
- estimated credits, actual credits, and the variance
- failure groups with the recommended remediation
- direct Cargo UI links for the play and tool

End with one recommended `Next step`: remediate failures before continuing, approve recurring daily
coverage for rows entering the managed segment, or proceed to account deduplication after matching
key coverage is healthy. Do not end the report with an open-ended offer.

Replace the write `matchingPropertyName` together with the workflow input and
play columns so the filter, the write match, and the extract all resolve the
same CRM record. Re-fetch pricing and re-preview costs before enabling the
schedule.

## Complete when

- the consumer file contains only the selected CRM action shapes
- `account_enrichment` is a deployed workflow-backed tool with no CRM access
- the compiled `account_enrichment` graph starts with a Filter and contains no CRM connector node
- `enrich_accounts` is the disabled play; its row workflow contains one Tool node targeting
  `account_enrichment`, followed by the only CRM update, and contains no provider connector node
- `node --import tsx evals/contract.mjs` passes against the adapted template
- the play model is `crm_accounts`
- the write matches the intended CRM record id
- the input, result schema, mappings, and per-field write policies match the approved field contract
- the managed segment excludes rows without an identifier and allows populated stale rows
- the write uses a CRM-native blank-only update flag or an explicit fresh-read
  guard
- `isEnabled: false`, `runCreationRule: noConcurrency`, daily scheduling, and
  `changeKinds: ["added"]` remain in the first plan
- the disabled play and tool have working direct Cargo UI links before run approval
- the operator approved the exact target and maximum estimated credits before execution
- the final report includes before-and-after field coverage, all outcomes, failures, actual credit
  variance, and a recommended next step
- no credential, customer data, or deploy command appears in the committed
  template
