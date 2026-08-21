# Define the Account model

Use the two model declarations in `cdk/play/account-enrichment.ts` as one adaptation surface.

## Reuse first

Inspect the consumer project. Reuse its authenticated CRM connector, CRM-backed Account model,
and native `accounts` model when they exist. Replace the example declarations with imports that
match the consumer project's folder conventions. Deploying a second global Account model creates
a resource collision and splits identity.

## CRM model

The concrete CRM model must:

- extract the CRM's Account or Company object with its live extractor configuration
- expose the real CRM record ID plus approved domain and LinkedIn URL columns
- declare `unification: { source: "integration" }`
- remain the model used by `enrich_accounts`

The play targets this model because its row ID belongs to the CRM and can be used safely by the
CRM write actions.

## Global Account

The fallback native model uses strong LinkedIn ID and LinkedIn handle keys, weak domain, and no
other keys. Adapt those strengths only from audit evidence. The global Account receives the CRM
source through unification and is used downstream for scoring and segmentation. It is not the
writeback model.

## Complete when

- exactly one native global Account model exists
- the CRM model participates in its unification
- the play uses the concrete CRM model rather than the native Account model
- no custom source-ID staging or claims model is required
