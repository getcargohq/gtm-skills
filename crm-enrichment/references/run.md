# Run

Adapt `infra/index.ts` after copying this folder into the consumer
project. The first plan is a disabled play and does not deploy from this
repository.

## Workflow and play boundary

`enrich_crm_account` is the per-row unit. It accepts the CRM record id plus the
optional LinkedIn handle, domain, and employee count from that same
`crm_accounts` row. It exits before a paid call when identifiers or fill-state
say so, calls one mutually exclusive provider route, and fills approved blank
fields. HubSpot's example matches `hs_object_id`. Salesforce matches `Id`.
Attio matches the record id.

`enrich_accounts` is orchestration. It runs that workflow over `crm_accounts`
and owns its managed backing segment through `filter`. Do not declare a
separate segment. Do not introduce a native `accounts` unification to sit
between the play and the CRM write.

A handle that already starts with `http` is used as the LinkedIn company URL.
Otherwise it is prefixed as `https://www.linkedin.com/company/<handle>`. Domain
is the fallback route.

If the CRM domain, LinkedIn URL, and employee count are already populated
(numeric zero counts as filled), the workflow returns `skipped_already_filled`
and makes no paid call. `cargo_last_enriched_at` and
`cargo_enrichment_status: succeeded` write only on the `written` path, after the
provider result and the CRM update.

Before every preview, run `cargo-ai connection integration get linkedin` and
read the applicable costs from
`integration.actions.enrichCompany.credits.costs` and
`integration.actions.enrichCompanyFromDomain.credits.costs`. Cost the eligible
CRM accounts with the current values and record when pricing was fetched.

## Verification

In this repository run `npm run validate`. In the consumer project:

1. Run `cargo-ai cdk types` after selecting the live CRM connector.
2. Run `cargo-ai cdk check`.
3. Run `cargo-ai cdk plan` and inspect every resource and action payload.
4. Confirm the plan has one CRM account model and no native `accounts` unification.
5. Show the operator target counts, mappings, live action costs, exact estimated
   credits, pricing lookup time, and that the play stays disabled.
6. Deploy or enable only after explicit approval.

Replace the write `matchingPropertyName` together with the workflow input and
play columns so the filter, the write match, and the extract all resolve the
same CRM record. Re-fetch pricing and re-preview costs before enabling the
schedule.

## Complete when

- the consumer file contains only the selected CRM action shapes
- the play model is `crm_accounts`
- the write matches the intended CRM record id
- a filled row exits as `skipped_already_filled` before a paid call
- the write uses a CRM-native blank-only update flag or an explicit fresh-read
  guard
- `isEnabled: false`, `runCreationRule: noConcurrency`, daily scheduling, and
  `changeKinds: ["added"]` remain in the first plan
- no credential, customer data, or deploy command appears in the committed
  template
