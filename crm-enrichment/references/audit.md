# Audit

Produce the audit before editing the CDK template. Re-read live CRM properties. Do not assume
property names, universal provider output paths, or that every CRM account is in scope.

Write `crm-enrichment-audit-YYYY-MM-DD.json` and a matching Markdown report with this minimum
JSON contract:

```json
{
  "generated_at": "ISO-8601 timestamp",
  "crm": "hubspot|salesforce|attio",
  "record_id_field": "hs_object_id",
  "total_accounts": 0,
  "properties": [
    {
      "semantic_key": "record_id|domain|website|linkedin_url|linkedin_id|employee_count|last_enriched_at|enrichment_status",
      "candidates": [
        {
          "label": "CRM label",
          "internal_name": "crm_internal_name",
          "type": "CRM type",
          "filled_count": 0,
          "fill_rate": 0
        }
      ],
      "recommended_primary": "crm_internal_name",
      "reason": "type-compatible field with the highest fill rate"
    }
  ],
  "gaps": {
    "missing_domain": 0,
    "missing_website": 0,
    "missing_linkedin_url": 0,
    "missing_linkedin_id": 0,
    "missing_company_relationship": 0
  },
  "pricing": {
    "fetched_at": "ISO-8601 timestamp",
    "cli_version": "cargo-ai version",
    "integration_slug": "linkedin",
    "linkedin_url_action": {
      "slug": "enrichCompany",
      "unit_credits": 0
    },
    "domain_action": {
      "slug": "enrichCompanyFromDomain",
      "unit_credits": 0
    }
  },
  "target_preview": {
    "eligible_accounts": 0,
    "percentage_of_total": 0,
    "linkedin_url_path": 0,
    "domain_path": 0,
    "skipped_no_identifier": 0,
    "linkedin_url_credits": 0,
    "domain_credits": 0,
    "total_credits": 0,
    "write_policy": {
      "default": "fill_blanks",
      "fields": [
        {
          "semantic_key": "domain",
          "eligible_writes": 0,
          "preserved_existing": 0
        }
      ]
    }
  }
}
```

The Markdown headings are `Summary`, `Duplicate properties`, `Enrichment gaps`, and `Target and
cost preview`. Every table must reproduce the JSON counts and percentages. The chat summary names
the recommended primary properties, largest gaps, eligible population, and exact credit estimate.
Do not invent a CRM health score. Report field-level evidence.

Recommend the most filled type-compatible property, preferring a CRM-native property on a tie.
The HubSpot example uses `hs_object_id` as `record_id_field`; Salesforce uses `Id`; Attio uses
the record id. Do not delete or rename CRM properties during audit.

If no compatible operational property exists, propose the exact property and pause for approval.
Use generic outcomes: `pending`, `succeeded`, `failed`, `identity_conflict`, and
`skipped_no_identifier`.

Before calculating credits, run `cargo-ai connection integration get linkedin`. Read the current,
applicable costs from `integration.actions.enrichCompany.credits.costs` and
`integration.actions.enrichCompanyFromDomain.credits.costs`; stop if the relevant entry is missing
or ambiguous. Credit math is
`linkedin_url_path * linkedin_url_unit_credits + domain_path * domain_unit_credits`. The route
counts are mutually exclusive and count eligible CRM accounts on the connected extract. Ask
whether to narrow the population after showing the preview.

## Complete when

- JSON, Markdown, and chat agree on every count
- no paid provider call or CRM write occurred
- every selected destination has a live name, type, and fill-rate justification
