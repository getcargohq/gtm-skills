# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Audit

- JSON, Markdown, and chat agree on property candidates, gaps, route counts, and costs.
- Unit costs come from a current `cargo-ai connection integration get linkedin` response, with the
  lookup timestamp, CLI version, action slugs, and applicable cost entries recorded.
- Credit math uses the fetched LinkedIn and domain unit costs.
- Route counts are mutually exclusive and count eligible native Accounts with the CRM source key.
- Primary destinations have live type and fill-rate evidence.
- No paid provider call or CRM write occurs during audit.

## CDK template

- `infra/account-enrichment.ts` is the only cookbook infrastructure source file.
- The consumer file contains only the selected CRM connector and action shapes.
- The concrete CRM Account model declares integration unification.
- Exactly one native global Account model exists in the consumer project.
- The native Account exposes the selected CRM record ID and freshness through computed and lookup
  columns, and it is the play model.
- The authoritative `additionalColumns` list preserves every unrelated native Account column, and
  the plan shows no removals.
- The reusable `account_enrichment` tool resolves one concrete CRM record ID from the Account
  `ids` map.
- The tool exits before a paid call while a field placeholder remains or no identifier exists.
- LinkedIn URL is attempted before domain fallback. A row takes at most one paid route.
- Fill-blanks uses a CRM-native conditional update or a fresh-read guard that preserves populated
  values, including numeric zero.
- Provider success writes the approved mappings, `enrichment_status`, and `last_enriched_at`.
- Provider or CRM connector errors remain failed workflow runs.
- The play filter requires an identifier and `last_enriched_at` null or older than six months.
- The disabled play evaluates daily, creates runs only for rows added to its managed segment, uses
  `noConcurrency`, and limits the pilot to 15.
- No standalone `defineSegment` exists.
- `cargo-ai cdk types`, `cargo-ai cdk check`, and `cargo-ai cdk plan` pass in the consumer project.

## Repository isolation

- The cookbook is one root skill. Its supporting Markdown files live under `references/`, and no
  nested `SKILL.md` exists.
- No CRM-specific template directories remain.
- The template contains no credential, deployment command, or customer data.
- No relative import leaves the cookbook.
