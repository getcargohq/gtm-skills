# Configure the pipeline

Apply only the field contract approved in the audit. Keep one CRM connector shape in the file and
reuse existing project resources when their schemas match.

## 1. Reconcile the CRM

The checked example uses HubSpot:

- account object: `companies`
- contact object: `contacts`
- record ID: `hs_object_id`
- write action: `updateRecords`
- blank-only behavior: `skipIfExist: true`

For Salesforce or Attio, replace the connector, extracts, object names, record IDs, write action,
and blank-only guard together. Do not leave a mixed CRM graph.

Confirm that `cargo_last_enriched_at` is a date-time property and
`cargo_enrichment_status` is compatible with the values the play writes. Create approved missing
properties in the CRM UI if the connector cannot create property definitions.

## 2. Configure the account path

Map only approved outputs from `account_enrichment`. Preserve the identifier gate, LinkedIn-first
route, domain fallback, and one play-owned CRM write. Business fields fill blanks only. Successful
writes stamp both operational fields.

## 3. Instantiate the two Cargo-native contact tools

In the live Cargo workspace, instantiate:

1. Find Email
2. Find LinkedIn Profile from Email

Inspect each deployed tool rather than relying on its display name. Record its UUID, accepted
inputs, output paths, and unit price.

Replace these placeholders in `infra/plays/enrich-contacts.ts`:

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

## 4. Configure Contact LinkedIn Enrichment

`contact_linkedin_enrichment` is the only custom contact tool. It accepts `linkedinUrl`, calls one
LinkedIn `enrichProfile` action, and returns approved person identity and role fields. It has no CRM
connector access.

Confirm the live provider paths for:

- stable person ID
- canonical LinkedIn profile URL
- current job title

Add optional outputs only after the operator approves their destination, type, transformation,
fill policy, and cost.

## 5. Preserve the play gates

`enrich_contacts` must keep these routes:

- LinkedIn and email present: skip both native tools, call custom enrichment.
- LinkedIn present and email blank: call Find Email, then custom enrichment.
- LinkedIn blank and email present: call Find LinkedIn Profile from Email. Stop if unresolved;
  otherwise call custom enrichment.
- Both identifiers blank: stop without any tool call.

The current CDK DSL needs explicit branches for real graph gating. A ternary that selects between
tool results can compile both tool nodes unconditionally. Inspect the compiled graph, not only the
TypeScript source.

Every successful route updates the triggering contact by CRM record ID, fills approved business
fields only when blank, then stamps successful freshness. An unresolved email route must not write
or stamp freshness.

## 6. Keep filters null-safe

The managed contact population requires:

- email or LinkedIn profile URL present
- `cargo_last_enriched_at` null or older than the approved window
- at least one approved destination blank

For every string destination, include both `isNull` and `isEmpty` in the blank group. Cargo's filter
schema intentionally spells the group key `conjonction`.

## 7. Validate before deployment

```sh
npm run typecheck
node scripts/check-pipelines.mjs
node --import tsx crm-enrichment/evals/contract.mjs
cargo-ai cdk plan
```

Inspect the plan and compiled graph for:

- one contact play
- exactly three contact tool targets
- a branch before each native lookup
- a result branch after Find LinkedIn Profile from Email
- no direct LinkedIn connector action in the play
- no CRM connector action in the custom tool
- no write path for unresolved or identifier-free rows

Deploy disabled and send the operator direct links to the play and custom tool before requesting
approval for a paid pilot.
