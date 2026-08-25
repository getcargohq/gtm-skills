# Define the Account model

Use the two model declarations in `infra/account-enrichment.ts` as one adaptation surface.

## Reuse first

Inspect the consumer project. Reuse its authenticated CRM connector and CRM-backed Account model
when they exist. If the native `accounts` model already exists and is configured, import and reuse
it, then remove the fallback native model declaration and configuration from the copied template.
Deploying or reconfiguring a second global Account model creates a resource collision and can
split identity.

The native model's `additionalColumns` list is authoritative. Read the live Account schema and
the consumer declaration, then merge the cookbook's source-ID and freshness columns into the full
existing list. A plan that removes any unrelated Account column fails review.

## CRM model

The concrete CRM model must:

- extract the CRM's Account or Company object with its live extractor configuration
- expose the real CRM record ID plus the approved freshness property
- declare `unification: { source: "integration" }`
- remain the writeback source resolved through the unified Account `ids` map

Audit the unified Account `ids` value and set `crmSourceKey` to the exact
`<dataset_slug>__<model_slug>` key for this CRM model. The reusable tool uses only the associated
source record ID for CRM actions.

## Global Account

The fallback native model uses strong LinkedIn ID and LinkedIn handle keys, weak domain, and no
other keys. Adapt those strengths only from audit evidence. The global Account receives the CRM
source through unification and is the model used by `enrich_accounts`.

Keep the two derived columns on this model:

- `computed__crm_record_id` extracts the selected source ID from `ids`
- `lookup__crm_last_enriched_at` joins that ID to the CRM model and exposes the live freshness
  value to the play's managed segment

The native unified Account remains read-only. Enrichment writes go to the CRM source record, and
the CRM sync refreshes the lookup value.

## Complete when

- exactly one native global Account model exists
- the CRM model participates in its unification
- the play uses the native unified Account model
- the audited `ids` key resolves the intended CRM record and the freshness lookup uses that ID
- the plan preserves every unrelated Account additional column
- no custom source-ID staging or claims model is required
