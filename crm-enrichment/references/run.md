# Run and report

Choose the account path, contact path, or both. Keep every selected play disabled through build
review. Each path needs its own approved field contract, priced population, write probe, pilot, and
report. Approval for one path does not authorize the other.

Before either pilot, run typechecking, pipeline validation, the compiled graph contract, and
`cargo-ai cdk plan`. Confirm every selected play is disabled and uses `noConcurrency`. Fetch live
prices and recount eligibility from the current model snapshot immediately before approval.

## Path 1: Run account enrichment

### Before the account pilot

1. Confirm the account audit and field contract are approved.
2. Confirm the company extract, CRM record ID, destinations, and write action match the live CRM.
3. Confirm the plan contains `crm_accounts`, `account_enrichment`, and `enrich_accounts` only once.
4. Confirm the tool chooses one provider route and contains no CRM action.
5. Confirm the play contains one Tool node, no direct LinkedIn action, and one CRM update.
6. Recount the LinkedIn URL and domain fallback routes.
7. Fetch both live provider prices and show the maximum account spend.
8. Send direct Cargo links for the disabled account play and tool.
9. Ask the operator to approve the account write probe and priced pilot.

### Account write probe

Choose a reversible company record with a usable identifier and at least one approved blank.
Verify:

- the CRM record ID matches exactly one company
- the expected provider route is the only paid route called
- existing business values, including numeric zero, remain unchanged
- approved blanks are filled
- successful freshness is stamped only after the CRM write
- the play reports the expected outcome

Restore only Cargo-owned operational stamps if the operator approved that cleanup. Do not clear or
overwrite provider-derived business values without explicit approval.

### Run the account population

Start only the approved account pilot. Monitor provider failures, CRM write failures, route counts,
and spend. Do not broaden filters or rerun failures until the operator understands whether another
provider charge will occur.

After a successful pilot, request a separate decision before enabling recurring account coverage.
Keep the schedule and freshness window shown in the reviewed plan.

### Account report

Report:

- direct links to the account play and tool
- eligible and processed companies
- LinkedIn URL, domain fallback, and no-identifier route counts
- records written, skipped, and failed
- before-and-after fill rate for every approved company destination
- actual spend by provider action and total, compared with the estimate
- confirmation that no existing business value was overwritten
- recommended next action and any remaining blocker

### Account stop conditions

Stop the account run and report the evidence if:

- the provider schema differs from the adapted mapping
- both company provider routes run for one record
- one CRM ID matches zero or multiple companies
- an existing business value changes without an approved refresh policy
- a failed or identifier-free record receives successful freshness
- actual paid calls exceed the approved route estimate

## Path 2: Run contact enrichment

### Before the contact pilot

1. Confirm the contact audit and field contract are approved.
2. Confirm both Cargo-native tool UUIDs and live schemas replaced the placeholders.
3. Confirm the contact extract, CRM record ID, destinations, and write action match the live CRM.
4. Confirm the plan has one contact play and only these three tool targets: Find Email, Find
   LinkedIn Profile from Email, and Contact LinkedIn Enrichment.
5. Recount both-identifiers, LinkedIn-only, email-only, and neither routes.
6. Fetch all three live tool prices and show the maximum contact spend.
7. Send direct Cargo links for the disabled contact play and custom tool.
8. Ask the operator to approve the contact write probe and priced pilot.

### Contact write probe

Choose a reversible contact record with a usable identifier and at least one approved blank.
Verify:

- the CRM record ID matches exactly one contact
- the expected route calls only its gated tools
- existing business values remain unchanged
- approved blanks are filled
- successful freshness is stamped only after the CRM write
- the play reports the expected outcome

Restore only Cargo-owned operational stamps if the operator approved that cleanup. Do not clear or
overwrite provider-derived business values without explicit approval.

### Contact route probes

Use fixtures or safe live rows to verify every state:

| State                         | Expected behavior                                                  |
| ----------------------------- | ------------------------------------------------------------------ |
| Email and LinkedIn            | Skip native tools, call custom enrichment, write blanks            |
| LinkedIn only                 | Call Find Email, call custom enrichment, write blanks              |
| Email only, resolver succeeds | Call profile resolver, call custom enrichment, write blanks        |
| Email only, resolver misses   | Call profile resolver, stop without custom enrichment or CRM write |
| Neither                       | No call and no write                                               |

Explicit successful branches compile three custom-tool call nodes. Every node targets the same
`contact_linkedin_enrichment` resource.

### Run the contact population

Start only the approved contact pilot. Monitor native tool failures, unresolved identifiers, custom
enrichment failures, CRM write failures, route counts, and spend. Do not broaden filters or rerun
failures until the operator understands whether another provider charge will occur.

After a successful pilot, request a separate decision before enabling recurring contact coverage.
Keep the schedule and freshness window shown in the reviewed plan.

### Contact report

Report:

- direct links to the contact play and custom tool
- eligible and processed contacts
- both-identifiers, LinkedIn-only, email-only, and neither route counts
- records written, unresolved, skipped, and failed
- before-and-after fill rate for every approved contact destination
- actual spend by tool and total, compared with the estimate
- confirmation that no existing business value was overwritten
- confirmation that unresolved rows did not receive successful freshness
- recommended next action and any remaining blocker

### Contact stop conditions

Stop the contact run and report the evidence if:

- a native or custom tool schema differs from the adapted call
- a gated tool runs on the wrong route
- one CRM ID matches zero or multiple contacts
- an existing business value changes
- an unresolved or identifier-free row writes or receives successful freshness
- actual paid calls exceed the approved route estimate
