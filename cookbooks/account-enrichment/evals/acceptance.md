# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Audit

- JSON, Markdown, and chat agree on property candidates, gaps, route counts, and costs.
- Credit math equals `linkedin_url_path * 0.25 + domain_path * 0.5`.
- Route counts are mutually exclusive and count eligible CRM rows.
- Primary destinations have live type and fill-rate evidence.
- No paid provider call or CRM write occurs during audit.

## CDK template

- `cdk/play/account-enrichment.ts` is the only cookbook CDK source file.
- The consumer file contains only the selected CRM connector and action shapes.
- The concrete CRM Account model declares integration unification and is the play model.
- Exactly one native global Account model exists in the consumer project.
- The reusable `account_enrichment` tool writes one concrete CRM record ID.
- The tool exits before a paid call while a field placeholder remains or no identifier exists.
- LinkedIn URL is attempted before domain fallback. A row takes at most one paid route.
- Fill-blanks uses a CRM-native conditional update or a fresh-read guard that preserves populated
  values, including numeric zero.
- Provider success writes the approved mappings, `enrichment_status`, and `last_enriched_at`.
- Provider or CRM connector errors remain failed workflow runs.
- The play filter encodes approved eligibility, remains disabled, and limits the pilot to 15.
- No standalone `defineSegment` exists.
- `cargo-ai cdk types`, `cargo-ai cdk check`, and `cargo-ai cdk plan` pass in the consumer project.

## Repository isolation

- No CRM-specific template directories remain.
- The template contains no credential, deployment command, or customer data.
- No relative import leaves the cookbook.
