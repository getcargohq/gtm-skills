# Run account enrichment

Adapt the single template at `infra/account-enrichment.ts`. It is a disabled 15-row pilot and
does not deploy from this repository.

## Tool and play boundary

`account_enrichment` is the reusable unit. It accepts one concrete CRM record ID plus an optional
LinkedIn URL and domain. It exits before a paid call when destinations are unconfigured or no
identifier exists. It calls one mutually exclusive provider route and fills approved blank fields
through the CRM's verified blank-only update behavior.

`enrich_accounts` is orchestration. It runs the tool over the concrete CRM Account model, uses the
CRM row ID for writeback, and owns its managed backing segment through `filter`. Do not declare a
separate segment.

LinkedIn URL is attempted first at 0.25 credits. Domain is the fallback at 0.5 credits. Cost the
eligible CRM rows. Duplicate CRM rows can produce duplicate paid calls, which must be included in
the preview.

The base mapping writes `enrichment_status: succeeded` and `last_enriched_at` only after the
provider result and CRM update call. Connector failures remain failed workflow runs. Monitor them
separately rather than stamping a successful status.

## Verification

In this repository run `npm run check:templates`. In the consumer project:

1. Run `cargo-ai cdk types` after selecting the live CRM connector.
2. Run `cargo-ai cdk check`.
3. Run `cargo-ai cdk plan` and inspect every resource and action payload.
4. Show the operator target counts, mappings, exact credits, and the disabled 15-row limit.
5. Deploy or enable only after explicit approval.

The managed segment intersects the approved population with rows whose `last_enriched_at` is null
or older than six months. Evaluate it daily and create runs only for rows added to that segment.
After a successful write, the freshness timestamp removes the row until it becomes six months old
again. Replace `crmFields.last_enriched_at` with the audited CRM property in the same edit as the
write mapping so both filter conditions resolve the real extracted column. Re-preview costs before
enabling the preconfigured daily schedule.

## Complete when

- the consumer file contains only the selected CRM action shapes
- the play model is the concrete CRM Account model
- the tool uses a CRM-native blank-only update flag or an explicit fresh-read guard
- `isEnabled: false`, `limit: 15`, `runCreationRule: noConcurrency`, daily scheduling, and
  `changeKinds: ["added"]` remain in the first plan
- no credential, customer data, or deploy command appears in the committed template
