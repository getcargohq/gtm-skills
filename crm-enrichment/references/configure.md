# Configure the pipeline

Choose the account path, contact path, or both. Apply only the field contract approved for each
selected path. Approval for one path does not authorize resources or writes for the other.

## Shared CRM setup

The checked example uses one HubSpot connector shape:

- company object: `companies`
- contact object: `contacts`
- record ID: `hs_object_id`
- write action: `updateRecords`
- blank-only behavior: `skipIfExist: true`

For Salesforce or Attio, replace the connector, selected extracts, object names, record IDs, write
action, and blank-only guard together. Do not leave a mixed CRM graph. Reuse matching existing
project resources instead of deploying duplicate slugs.

Confirm that `cargo_last_enriched_at` is a date-time property and
`cargo_enrichment_status` accepts the values written by each selected play. Create approved missing
properties in the CRM UI if the connector cannot create property definitions.

## Path 1: Configure account enrichment

### Resources

The account path consists only of:

- `infra/models/crm-accounts.ts`
- `infra/tools/account-enrichment.ts`
- `infra/plays/enrich-accounts.ts`

`crm_accounts` must remain a direct CRM company extract. `account_enrichment` owns provider routing
and has no CRM access. `enrich_accounts` owns the only company write.

### Provider routes

Preserve these mutually exclusive routes:

- LinkedIn company page present: normalize the URL or handle and call `enrichCompany`.
- LinkedIn page blank and domain present: call `enrichCompanyFromDomain`.
- Both identifiers blank: stop without a provider call.

LinkedIn identity is stronger and remains first. Do not move either provider action into the play.

### Mappings and filter

Map only approved outputs from `account_enrichment`. The checked HubSpot starting fields are
`linkedin_company_id`, `name`, `domain`, `website`, `linkedin_company_page`, and
`numberofemployees`.

Every business-field mapping is blank-only unless the operator explicitly approved a refresh
policy. A fresh read must protect populated values, including numeric zero, on CRMs without a
native blank-only flag. Stamp freshness only after the CRM update.

The `enrich_accounts` filter requires:

- LinkedIn company page or domain present
- `cargo_last_enriched_at` null or older than the approved window

Do not add a blank-destination condition to the account filter. Populated stale records must remain
eligible for an explicitly approved refresh policy.

### Account graph review

Confirm the compiled graph has:

- one identifier gate and one mutually exclusive provider branch in `account_enrichment`
- no CRM connector action in `account_enrichment`
- one Tool node targeting `account_enrichment` in `enrich_accounts`
- no direct LinkedIn action in `enrich_accounts`
- one play-owned CRM update matching the audited company record ID
- a disabled play with `noConcurrency`

## Path 2: Configure contact enrichment

### Resources

The contact path consists only of:

- `infra/models/crm-contacts.ts`
- `infra/tools/contact-linkedin-enrichment.ts`
- `infra/plays/enrich-contacts.ts`

`crm_contacts` must remain a direct CRM contact extract. `contact_linkedin_enrichment` owns the
LinkedIn profile action and has no CRM access. `enrich_contacts` owns identifier resolution, gating,
and every contact write.

### Instantiate the Cargo-native tools

In the live workspace, instantiate:

1. Find Email
2. Find LinkedIn Profile from Email

Inspect each deployed tool. Record its UUID, accepted inputs, output paths, and live unit price.
Replace these values in `infra/plays/enrich-contacts.ts`:

```ts
"REPLACE-WITH-FIND-EMAIL-TOOL-UUID";
"REPLACE-WITH-FIND-LINKEDIN-PROFILE-FROM-EMAIL-TOOL-UUID";
```

The example expects:

| Tool                             | Inputs                                    | Output         |
| -------------------------------- | ----------------------------------------- | -------------- |
| Find Email                       | `linkedin_url`, `first_name`, `last_name` | `email`        |
| Find LinkedIn Profile from Email | `email`                                   | `linkedin_url` |

If the live schema differs, adapt the call and output access together. Never guess a nested path.

### Configure Contact LinkedIn Enrichment

`contact_linkedin_enrichment` accepts `linkedinUrl`, calls one LinkedIn `enrichProfile` action, and
returns approved person identity and role fields. Confirm the live output paths for stable person
ID, canonical profile URL, and current job title.

Add optional outputs only after the operator approves their destination, type, transformation,
write policy, and cost.

### Preserve the contact gates

`enrich_contacts` must keep these routes:

- LinkedIn and email present: skip both native tools, then call custom enrichment.
- LinkedIn present and email blank: call Find Email, then custom enrichment.
- LinkedIn blank and email present: call Find LinkedIn Profile from Email. Stop if unresolved;
  otherwise call custom enrichment.
- Both identifiers blank: stop without any tool call.

Use explicit branches. A ternary that selects between tool results can compile both tool nodes
unconditionally. Inspect the compiled graph, not only the TypeScript source.

Every successful route updates the triggering contact by CRM record ID and fills approved business
fields only when blank. An unresolved email route must not write or stamp freshness.

### Contact filter

The `enrich_contacts` filter requires:

- email or LinkedIn profile URL present
- `cargo_last_enriched_at` null or older than the approved window
- at least one approved contact destination blank

For every blank string destination, include both `isNull` and `isEmpty`. Cargo's filter schema
intentionally spells the group key `conjonction`.

### Contact graph review

Confirm the compiled graph has:

- one contact play and exactly three tool targets
- a branch before each native lookup
- a result branch after Find LinkedIn Profile from Email
- no custom enrichment call without a LinkedIn URL
- no direct LinkedIn connector action in the play
- no CRM connector action in the custom tool
- no write path for unresolved or identifier-free rows
- a disabled play with `noConcurrency`

## Validate selected paths

```sh
npm run typecheck
node scripts/check-pipelines.mjs
node --import tsx crm-enrichment/evals/contract.mjs
cargo-ai cdk plan
```

Deploy only the selected paths, with every play disabled. Send direct Cargo links for every deployed
play and custom tool before requesting approval for a paid pilot.
