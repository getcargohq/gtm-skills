# Audit contract

Choose the account path, contact path, or both. Audit every selected path independently before
editing CDK, making a paid call, or writing to the CRM. Approval for one path does not approve the
other.

For every selected path, first inspect the authenticated CRM connector, existing CDK resources,
object schema, record ID, blank representation, Cargo-owned operational fields, and slug
collisions. Do not guess provider paths or tool contracts from this repository example.

## Path 1: Account enrichment audit

### Inspect live resources

Collect:

- CRM company object, extractor, record ID, property schemas, and write action.
- LinkedIn `enrichCompany` and `enrichCompanyFromDomain` input, output, and live pricing schemas.
- Existing compatible company properties and genuine customer-managed duplicates.
- Counts for the LinkedIn URL route, domain fallback route, and records with no usable identifier.

### Account field recommendation

Present one row per company provider property:

| Field | Provider path | Provider and action | Output type | CRM destination | Current fill rate | Transformation | Write policy | Recommendation | Decision |
| ----- | ------------- | ------------------- | ----------- | --------------- | ----------------- | -------------- | ------------ | -------------- | -------- |

The starting destinations are:

- `linkedin_company_id`
- `name`
- `domain`
- `website`
- `linkedin_company_page`
- `numberofemployees`

Reuse a compatible destination when one exists. If a new property is needed, show its internal name
and type and wait for approval before creating it. Provider-derived business properties keep neutral
names. `cargo_last_enriched_at` and `cargo_enrichment_status` are Cargo-owned operational fields.

Report duplicate-property findings separately. Exclude CRM system properties and generic native
properties unless they are genuine customer-managed duplicates. If none exist, say
`No duplicate properties detected`.

### Account route and cost evidence

Count eligible records in mutually exclusive routes:

| Route           | Definition                             | Provider action           |
| --------------- | -------------------------------------- | ------------------------- |
| LinkedIn URL    | LinkedIn company page present          | `enrichCompany`           |
| Domain fallback | LinkedIn page blank and domain present | `enrichCompanyFromDomain` |
| No identifier   | LinkedIn page and domain blank         | No call and not eligible  |

Eligibility also requires null-or-stale `cargo_last_enriched_at`. Account destination fill-state is
not an eligibility condition because an explicitly approved refresh policy may re-enrich a populated
stale field.

Record the live action prices, lookup timestamp, CLI version, route counts, and maximum account
spend. Do not make a paid call during the audit.

### Account evidence object

```json
{
  "path": "account_enrichment",
  "crm": {
    "integration": "hubspot",
    "object": "companies",
    "record_id": "hs_object_id"
  },
  "approved_fields": [],
  "route_counts": {
    "linkedin_url": 0,
    "domain_fallback": 0,
    "no_identifier": 0
  },
  "eligible_records": 0,
  "refresh_window": "6 months",
  "estimated_max_credits": null,
  "operator_approval": {
    "field_contract": false,
    "disabled_deployment": false,
    "paid_pilot": false
  }
}
```

The account audit is complete when schemas, record identity, destinations, mutually exclusive route
counts, live pricing, and all three approvals are recorded.

## Path 2: Contact enrichment audit

### Inspect live resources

Collect:

- CRM contact object, extractor, record ID, property schemas, and write action.
- LinkedIn profile enrichment input, output, and live pricing schema.
- Cargo-native Find Email and Find LinkedIn Profile from Email availability, UUIDs, inputs, outputs,
  and live unit prices.
- Existing compatible contact properties and genuine customer-managed duplicates.

### Contact field recommendation

Present one row per contact provider property using the same field-contract columns as the account
path. The starting destinations are:

- `email`
- `linkedin_person_id`
- `linkedin_profile_url`
- `jobtitle`

Reuse compatible properties and keep provider-derived business properties neutral. Confirm
`cargo_last_enriched_at` and `cargo_enrichment_status` separately as operational fields.

### Contact route and cost evidence

Count mutually exclusive eligible rows:

| Route            | Definition                    | Calls per row                                                                  |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| Both identifiers | Email and LinkedIn present    | Contact LinkedIn Enrichment                                                    |
| LinkedIn only    | LinkedIn present, email blank | Find Email, then Contact LinkedIn Enrichment                                   |
| Email only       | Email present, LinkedIn blank | Find LinkedIn Profile from Email, then Contact LinkedIn Enrichment if resolved |
| Neither          | Both blank                    | No call and not eligible                                                       |

Eligibility also requires null-or-stale `cargo_last_enriched_at` and at least one approved blank
destination. Pair `isNull` with `isEmpty` for every blank string check.

Record each live tool price, the lookup timestamp, route counts, resolver assumptions, and maximum
contact spend. Do not make a paid call during the audit.

### Contact evidence object

```json
{
  "path": "contact_enrichment",
  "crm": {
    "integration": "hubspot",
    "object": "contacts",
    "record_id": "hs_object_id"
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
  "eligible_records": 0,
  "refresh_window": "6 months",
  "estimated_max_credits": null,
  "operator_approval": {
    "field_contract": false,
    "disabled_deployment": false,
    "paid_pilot": false
  }
}
```

The contact audit is complete when the CRM and three tool contracts, destinations, mutually
exclusive route counts, live pricing, and all three approvals are recorded.
