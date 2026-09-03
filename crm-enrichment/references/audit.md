# Audit

Produce the audit before editing the CDK template. Re-read live CRM properties. Do not assume
property names, universal provider output paths, or that every CRM account or contact is in
scope. Audit the path the operator asked for — accounts, contacts, or both.

Write `crm-enrichment-audit-YYYY-MM-DD.json` and a matching Markdown report. The account path
uses this minimum JSON contract:

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

The people path reuses that contract with the contact object swapped in — `total_contacts`,
contact `field_selection` candidates from the live person-enrichment and resolver actions, and
contact routes in `target_preview` (`linkedin_url_path`, `email_resolver_path`,
`skipped_no_identifier`; the resolver path prices the chain) — plus this people-only block:

```json
{
  "contacts": {
    "gaps": {
      "missing_work_email": 0,
      "missing_phone": 0,
      "missing_linkedin_url": 0,
      "missing_linkedin_person_id": 0,
      "missing_job_title": 0,
      "missing_primary_company": 0
    },
    "company_side_gaps": {
      "missing_domain": 0,
      "missing_linkedin_company_id": 0,
      "missing_customer_status": 0
    },
    "customer_status_mapping": {
      "relationship": "contact_primary_company (primary associated company only)",
      "property": "lifecyclestage",
      "customer_values": ["customer"],
      "read_through_relationship": true,
      "relationship_preexisting": false,
      "evidence": "how the live portal was checked",
      "status": "pending_operator_confirmation|confirmed",
      "customer_contacts": 0,
      "non_customer_contacts": 0
    },
    "champion_coverage": {
      "customer_companies_missing_domain": 0,
      "customer_companies_missing_website": 0,
      "customer_companies_missing_linkedin_page": 0,
      "unmatchable_champions": 0,
      "policy": "fill_manually|priced_resolution|matchable_only|pending"
    },
    "operational_fields": [
      {
        "purpose": "last_enriched_at|enrichment_status|primary_employment_status",
        "equivalent_candidates": [
          {
            "internal_name": "crm_internal_name",
            "type": "CRM type",
            "filled_count": 0,
            "fill_rate": 0
          }
        ],
        "decision": "reuse|create",
        "property": "cargo_last_enriched_at",
        "reason": "usage and fill-rate evidence; never a second duplicate"
      }
    ],
    "play_split": {
      "enrich_contacts_eligible": 0,
      "monitor_champions_eligible": 0
    }
  }
}
```

Audit these contact fields at minimum: work email, phone, LinkedIn profile URL, LinkedIn person
ID, job title, and the primary associated company link. On the company side of the contact audit:
domain, LinkedIn company URL and ID, and the customer-status property — required to know whether
a former company was a customer. The customer-status mapping is detected from the live schema and
data (HubSpot example: the primary associated company's `Lifecycle stage = Customer`; Salesforce:
`Contact.AccountId → Account.<customer status field>`), always through the contact's primary
company relationship — the `contact_primary_company` relationship the plays filter through,
never an arbitrary associated company and never the contact's own lifecycle field, which portals
do not reliably sync — with the exact live values that
mean "customer" listed, and it stays `pending_operator_confirmation` until the operator confirms
it. Record whether an identical relationship already exists on the dataset: an existing one is
adopted, not duplicated.

`champion_coverage` is the coverage gate's evidence: count the customer companies missing each
matching identifier and the champions that are unmatchable as a result, and hold `policy` at
`pending` until the operator chooses — fill the identifiers by hand, approve a priced
name→domain resolution step quoted live, or run only the matchable champions. The counts come
from the account extract; no paid call is needed to produce them.

The operational-field audit is reuse-else-propose. If equivalent properties already exist for the
freshness stamp, the outcome stamp, or the employment status, recommend the canonical one on
usage and fill-rate evidence — do not create another duplicate. If none exists, mark the property
for creation before launch: `cargo_last_enriched_at` (date and time) and `cargo_enrichment_status`
(string) carry the `cargo_` prefix; `primary_employment_status` (single select, `Active`/`Left`)
is a business property and keeps its neutral name. Creation itself is a manual CRM UI step — the
connector has no create-property action — governed by the verbatim-name, case-sensitive-enum,
and date-and-time rules in [`configure.md`](configure.md).

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
in the operator approval. Do not silently create it during audit. On the people path, class the
provider's person ID the same way — it is the durable person matching key behind the
one-person-one-contact rule — proposing `linkedin_person_id` when no compatible property exists,
with the LinkedIn profile URL and job title completing the starting recommendation.

`duplicate_properties` contains only genuine duplicate groups among customer-managed CRM
properties. Exclude CRM-managed and system-generated properties, including HubSpot `hs_*` fields.
Also exclude generic native properties merely because they could receive a similar provider value.
They may still appear as destination candidates under `field_selection`, but not as duplicate
findings. Require at least two customer-managed properties with the same clear semantic purpose for
a duplicate group. If none exist, emit an empty array and state `No duplicate properties detected`
in Markdown and chat. Never infer ownership from fill rate alone.

The Markdown headings are `Summary`, `Duplicate properties`, `Enrichment gaps`, and `Target and
cost preview`, with a `Field selection` subsection before the target preview; the people path
adds `Customer-status mapping` and `Operational fields` between the gaps and the field
selection. Every table must
reproduce the JSON counts and percentages. The chat summary names the approved provider fields,
destinations and transformations, excluded candidates with reasons, recommended primary
properties, largest gaps, eligible population — split by play on the people path — and exact
credit estimate. Do not invent a CRM
health score. Report field-level evidence: "10,800 contacts have no work email" is the audit's
voice, "your CRM health is 3/5" is not.

Recommend the most filled type-compatible property, preferring a CRM-native property on a tie.
The HubSpot example uses `hs_object_id` as `record_id_field`; Salesforce uses `Id`; Attio uses
the record id. Do not delete or rename CRM properties during audit.

If no compatible operational property exists, propose the exact property and pause for approval.
Use generic outcomes: `pending`, `succeeded`, `partial`, `failed`, `identity_conflict`, and
`skipped_no_identifier`. The pseudo-vocabulary Success/Partial/Failed maps onto that set:
Success is `succeeded`, Partial is `partial` (a job change whose new company is not yet in the
CRM), and Failed is a failed workflow run, which never stamps freshness.

Before calculating credits, fetch live prices for the audited path. Accounts:
`cargo-ai connection integration get linkedin`, reading
`integration.actions.enrichCompany.credits.costs` and
`integration.actions.enrichCompanyFromDomain.credits.costs`. Contacts: the same lookup for
`integration.actions.enrichProfile.credits.costs`, plus the instantiated "Find LinkedIn URL
from email" template tool's live per-row quote; stop if the relevant entry is missing
or ambiguous. Credit math is
`linkedin_url_path * linkedin_url_unit_credits + domain_path * domain_unit_credits` for accounts
and
`linkedin_url_path * person_enrich_unit_credits + email_path * (resolver_unit_credits + person_enrich_unit_credits)`
for contacts. The route
counts are mutually exclusive and count eligible CRM rows on the connected extract — on the
people path, split by play, because the two filters own disjoint populations. Ask
whether to narrow the population after showing the preview: enriching every eligible contact and
creating a governed sub-segment are both valid answers, and the choice belongs to the operator.

## Complete when

- JSON, Markdown, and chat agree on every count
- no paid provider call or CRM write occurred
- the operator approved the complete field contract before the final target and cost preview
- every live LinkedIn output has an include or exclude decision with evidence
- every selected destination has a live name, type, and fill-rate justification
- duplicate findings contain only genuine customer-managed semantic duplicates and exclude
  HubSpot `hs_*`, CRM-managed, system-generated, and generic native properties
- on the people path: the customer-status mapping is operator-confirmed with its exact live
  values and its `contact_primary_company` read path, every operational field has a
  reuse-or-create decision,
  the champion-coverage counts are presented with the operator's chosen policy,
  and the eligible population is split between `enrich_contacts` and `monitor_champions`
