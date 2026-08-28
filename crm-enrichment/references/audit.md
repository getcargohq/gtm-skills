# Audit

Produce the audit before editing the CDK template. Re-read live CRM properties. Do not assume
property names, universal provider output paths, or that every CRM account is in scope.

This file audits enrichment fields and duplicate CRM property definitions. It does not classify
duplicate account records. When account deduplication is in scope, run the identity audit in
[`deduplicate.md`](deduplicate.md) against the same `crm_accounts` extract and keep its counts in a
separate artifact.

Write `crm-enrichment-audit-YYYY-MM-DD.json` and a matching Markdown report with this minimum
JSON contract:

```json
{
  "generated_at": "ISO-8601 timestamp",
  "crm": "hubspot|salesforce|attio",
  "record_id_field": "hs_object_id",
  "total_accounts": 0,
  "duplicate_properties": [
    {
      "semantic_key": "customer-managed semantic key",
      "candidates": [
        {
          "label": "CRM label",
          "internal_name": "crm_internal_name",
          "type": "CRM type",
          "ownership": "customer_managed",
          "filled_count": 0,
          "fill_rate": 0
        }
      ],
      "recommended_primary": "crm_internal_name",
      "reason": "type-compatible field with the highest fill rate"
    }
  ],
  "field_selection": {
    "status": "approved",
    "approved_at": "ISO-8601 timestamp",
    "candidates": [
      {
        "provider": "live provider name or integration slug",
        "provider_path": "company_name",
        "provider_type": "string",
        "available_on": ["enrichCompany", "enrichCompanyFromDomain"],
        "class": "starting_recommendation|optional_direct|requires_transformation|unsupported",
        "crm_candidates": [
          {
            "internal_name": "name",
            "type": "string",
            "filled_count": 0,
            "fill_rate": 0
          }
        ],
        "recommended_destination": "name|null",
        "destination_state": "existing|proposed|none",
        "destination_type": "string|null",
        "transformation": "none|exact approved conversion|unsupported",
        "write_policy": "fill_blanks",
        "recommendation": "include|exclude",
        "reason": "semantic and type compatibility, fill evidence, and operational tradeoff",
        "operator_decision": "include|exclude"
      }
    ]
  },
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
          "provider_path": "domain",
          "destination": "domain",
          "eligible_writes": 0,
          "preserved_existing": 0
        }
      ]
    }
  }
}
```

`field_selection.candidates` covers every live output path from both selected LinkedIn actions and
records which routes return it. Use exactly one row per exact provider path in the JSON, Markdown,
and chat presentation. Never group multiple provider properties into one row, even when they share
the same compatibility decision. Every row names the actual provider used so the operator knows
where the proposed value comes from. Derive the name from the live connector and action used by the
adapted workflow. Do not copy the checked example's `LinkedIn` label when another provider supplies
the field. The starting recommendation is not pre-approved. Before operator approval, its status is
`pending_operator_approval`, every candidate decision is `pending`, and the audit is incomplete. Do
not present `target_preview` as final while the field selection is pending.

After approval, set the status to `approved`, record `approved_at`, and give every candidate an
`include` or `exclude` decision. Every included field has a live destination, write policy, and
either matching types or an explicit transformation. Every excluded field has a reason. Calculate
the eligible population from identifier, freshness, and approved governance filters. Calculate
write-policy counts from the included destinations. Adding a selected field changes the proposed
writes, not segment eligibility, so recompute the write preview after approval.

Class provider `company_id` as `starting_recommendation` because it is the LinkedIn company ID
matching key. Recommend the most-filled compatible CRM property. When HubSpot has none, propose
`linkedin_company_id` with `destination_state: proposed`, type `string`, and include creation
in the operator approval. Do not silently create it during audit.

`duplicate_properties` contains only genuine duplicate groups among customer-managed CRM
properties. Exclude CRM-managed and system-generated properties, including HubSpot `hs_*` fields.
Also exclude generic native properties merely because they could receive a similar provider value.
They may still appear as destination candidates under `field_selection`, but not as duplicate
findings. Require at least two customer-managed properties with the same clear semantic purpose for
a duplicate group. If none exist, emit an empty array and state `No duplicate properties detected`
in Markdown and chat. Never infer ownership from fill rate alone.

The Markdown headings are `Summary`, `Duplicate properties`, `Enrichment gaps`, and `Target and
cost preview`, with a `Field selection` subsection before the target preview. Every table must
reproduce the JSON counts and percentages. The chat summary names the approved provider fields,
destinations and transformations, excluded candidates with reasons, recommended primary
properties, largest gaps, eligible population, and exact credit estimate. Do not invent a CRM
health score. Report field-level evidence.

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
- the operator approved the complete field contract before the final target and cost preview
- every live LinkedIn output has an include or exclude decision with evidence
- every selected destination has a live name, type, and fill-rate justification
- duplicate findings contain only genuine customer-managed semantic duplicates and exclude
  HubSpot `hs_*`, CRM-managed, system-generated, and generic native properties
