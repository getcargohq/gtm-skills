# Audit contract

Audit before editing CDK, making a paid call, or writing to the CRM. The output must let the
operator approve the exact fields, population, and maximum spend.

## Inspect live resources

Collect:

- CRM connector, object names, record ID fields, property schemas, and blank representation.
- Existing Cargo models, connectors, tools, plays, and slug collisions.
- LinkedIn company and profile enrichment input and output schemas.
- Cargo-native Find Email and Find LinkedIn Profile from Email template availability, inputs,
  outputs, and live unit prices.
- Existing compatible CRM properties and genuine customer-managed duplicates.

Do not guess provider paths or native tool contracts from this repository example.

## Field recommendation

Present one row per provider property:

| Field | Provider path | Provider and action | Output type | CRM destination | Current fill rate | Transformation | Write policy | Recommendation | Decision |
| ----- | ------------- | ------------------- | ----------- | --------------- | ----------------- | -------------- | ------------ | -------------- | -------- |

Starting account destinations:

- `linkedin_company_id`
- `name`
- `domain`
- `website`
- `linkedin_company_page`
- `numberofemployees`

Starting contact destinations:

- `email`
- `linkedin_person_id`
- `linkedin_profile_url`
- `jobtitle`

Operational fields are `cargo_last_enriched_at` and `cargo_enrichment_status`. Provider-derived
business properties keep neutral names. Reuse a compatible destination when one exists. If a new
property is needed, show its internal name and type and wait for approval before creating it.

Report duplicate-property findings separately. Exclude CRM system properties and generic native
properties unless they are genuine customer-managed duplicates. If none exist, say
`No duplicate properties detected`.

## Contact route counts

Count mutually exclusive eligible rows:

| Route            | Definition                    | Calls per row                                                                  |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| Both identifiers | Email and LinkedIn present    | Contact LinkedIn Enrichment                                                    |
| LinkedIn only    | LinkedIn present, email blank | Find Email, Contact LinkedIn Enrichment                                        |
| Email only       | Email present, LinkedIn blank | Find LinkedIn Profile from Email, then Contact LinkedIn Enrichment if resolved |
| Neither          | Both blank                    | No call and not eligible                                                       |

Eligibility also requires null-or-stale `cargo_last_enriched_at` and at least one approved blank
destination. Pair `isNull` with `isEmpty` for every blank string check.

## Machine-readable evidence

Save the audit in this shape so planning and reporting use the same facts:

```json
{
  "crm": {
    "integration": "hubspot",
    "account_object": "companies",
    "contact_object": "contacts",
    "account_record_id": "hs_object_id",
    "contact_record_id": "hs_object_id"
  },
  "native_tools": {
    "find_email": {
      "uuid": "<deployed UUID>",
      "inputs": ["linkedin_url", "first_name", "last_name"],
      "output": "email",
      "unit_credits": null
    },
    "find_linkedin_profile_from_email": {
      "uuid": "<deployed UUID>",
      "inputs": ["email"],
      "output": "linkedin_url",
      "unit_credits": null
    }
  },
  "approved_fields": [],
  "route_counts": {
    "both_identifiers": 0,
    "linkedin_only": 0,
    "email_only": 0,
    "neither": 0
  },
  "eligible_accounts": 0,
  "eligible_contacts": 0,
  "refresh_window": "6 months",
  "estimated_max_credits": null,
  "operator_approval": {
    "field_contract": false,
    "disabled_deployment": false,
    "paid_pilot": false
  }
}
```

`approved_fields` contains one object per destination with provider path, output type,
transformation, write policy, and operator decision. `estimated_max_credits` stays null until live
prices and route counts are available.

## Audit complete when

- Live CRM, provider, and native tool schemas were inspected.
- Record IDs and blank semantics were verified.
- The operator saw one decision row per field.
- Native tool UUIDs and output paths were confirmed.
- Mutually exclusive route counts and maximum credits were shown.
- The operator approved the field contract and disabled deployment separately from the paid run.
