# Run account enrichment

Adapt the single template at `infra/account-enrichment.ts`. It is a disabled 15-row pilot and
does not deploy from this repository.

## Tool and play boundary

`account_enrichment` is the reusable unit. It accepts the native Account `ids` map plus an optional
LinkedIn handle and domain, constructing the provider's LinkedIn company URL from that handle. It
resolves the audited CRM source key, exits before a paid call when the key, destinations, or
identifiers are unavailable, calls one mutually exclusive provider route, and fills approved blank
fields through the CRM's verified blank-only update behavior.

`enrich_accounts` is orchestration. It runs the tool over Cargo's native unified Account model and
owns its managed backing segment through `filter`. The tool reads the CRM record ID from `ids`; it
never sends the canonical Account ID to a CRM action. Do not declare a separate segment.

LinkedIn is attempted first and domain is the fallback. Before every preview, run
`cargo-ai connection integration get linkedin` and read the applicable costs from
`integration.actions.enrichCompany.credits.costs` and
`integration.actions.enrichCompanyFromDomain.credits.costs`. Cost the eligible native Accounts
with the current values and record when pricing was fetched.

The base mapping writes `enrichment_status: succeeded` and `last_enriched_at` only after the
provider result and CRM update call. Connector failures remain failed workflow runs. Monitor them
separately rather than stamping a successful status.

## Verification

In this repository run `npm run validate`. In the consumer project:

1. Run `cargo-ai cdk types` after selecting the live CRM connector.
2. Run `cargo-ai cdk check`.
3. Run `cargo-ai cdk plan` and inspect every resource and action payload.
4. Confirm the plan removes no unrelated native Account additional columns.
5. Show the operator target counts, mappings, live action costs, exact estimated credits, pricing
   lookup time, and the disabled 15-row limit.
6. Deploy or enable only after explicit approval.

The managed native Account segment intersects the approved population with rows whose CRM
freshness lookup is null or older than six months. Evaluate it daily and create runs only for rows
added to that segment. After a successful write and CRM sync, the lookup timestamp removes the row
until it becomes six months old again. Replace `crmSourceKey` and
`crmFields.last_enriched_at` together so the computed source ID, lookup, and write mapping resolve
the same CRM record. Re-fetch pricing and re-preview costs before enabling the schedule.

## Complete when

- the consumer file contains only the selected CRM action shapes
- the play model is the native unified Account model
- the tool resolves the intended CRM source record from the Account `ids` map
- the tool uses a CRM-native blank-only update flag or an explicit fresh-read guard
- `isEnabled: false`, `limit: 15`, `runCreationRule: noConcurrency`, daily scheduling, and
  `changeKinds: ["added"]` remain in the first plan
- no credential, customer data, or deploy command appears in the committed template
