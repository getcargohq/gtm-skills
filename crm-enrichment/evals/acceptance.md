# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Audit

- Before the exact target or cost preview, the agent presents the starting recommendation,
  direct-compatible optional fields, transformation-required fields, and unsupported fields from
  the live LinkedIn and CRM schemas.
- The agent asks for approval of a concrete field-contract table, not whether the operator wants
  unspecified "more fields". Silence does not approve the starting recommendation.
- The field-contract table contains exactly one row per exact provider property. No row groups
  multiple fields or shares ambiguous types, routes, destinations, fill rates, or decisions.
- Every field-contract row names the actual provider used, derived from the live connector and
  action. The value matches the adapted workflow instead of being hard-coded from the example.
- Duplicate-property findings contain only genuine customer-managed semantic duplicates. HubSpot
  `hs_*`, CRM-managed, system-generated, and generic native properties are excluded; an audit with
  no qualifying group states `No duplicate properties detected`.
- Provider `company_id` is in the starting recommendation as the LinkedIn company ID matching key.
  The agent reuses a compatible CRM property or proposes an exact string property for approval.
- The audit records every live LinkedIn output as included or excluded, with destination, types,
  transformation, write policy, and reason where applicable.
- JSON, Markdown, and chat agree on property candidates, gaps, route counts, and costs.
- Unit costs come from a current `cargo-ai connection integration get linkedin` response, with the
  lookup timestamp, CLI version, action slugs, and applicable cost entries recorded.
- Credit math uses the fetched LinkedIn and domain unit costs.
- Route counts are mutually exclusive and count eligible CRM accounts on `crm_accounts` after the
  field contract is approved.
- Primary destinations have live type and fill-rate evidence.
- No paid provider call or CRM write occurs during audit.

## CDK template

- `infra/index.ts` is the only infrastructure source file.
- The consumer file contains only the selected CRM connector and action shapes.
- Exactly one CRM account model exists (`crm_accounts` in the example). The play uses it.
- There is no native `accounts` unification.
- Freshness and fill-state are columns on `crm_accounts`.
- The write matches the audited CRM record id (`hs_object_id` in the HubSpot example).
- The workflow exits before a paid call when no identifier exists or the approved CRM
  destinations are already filled (`skipped_already_filled`).
- The workflow input, result schema, write mappings, and play fill-state filter cover exactly the
  approved field contract.
- LinkedIn URL is attempted before domain fallback. A handle that is already an `http` URL is used
  as-is. A row takes at most one paid route.
- Fill-blanks uses a CRM-native conditional update or a fresh-read guard that preserves populated
  values, including numeric zero.
- `last_enriched_at` and `enrichment_status: succeeded` write only after a provider result
  and a CRM update on the `written` path. A no-op does not stamp freshness.
- Provider or CRM connector errors remain failed workflow runs.
- The play filter requires an identifier and `last_enriched_at` null or older than six
  months.
- The disabled play evaluates daily, creates runs only for rows added to its managed segment, and
  uses `noConcurrency`.
- No standalone `defineSegment` exists.
- `cargo-ai cdk types`, `cargo-ai cdk check`, and `cargo-ai cdk plan` pass in the consumer project.

## Repository isolation

- This is one root skill. Its supporting Markdown files live under `references/`, and no
  nested `SKILL.md` exists.
- No CRM-specific template directories remain.
- The template contains no credential, deployment command, or customer data.
- No relative import leaves the skill.
