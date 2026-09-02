# Run

Adapt `infra/index.ts` after copying this folder into the consumer
project. The first plan is a disabled play and does not deploy from this
repository.

## Phase handoffs

Every message names the current phase and ends with `Next step`. A phase-boundary handoff contains
the evidence the operator needs, one concrete approval request, what approval unlocks, and what
remains blocked. An in-progress update says `No action needed` and names the next checkpoint.

After field-contract approval and explicit authorization to deploy disabled resources, deploy the
tool and every play for the audited path with each play set to `isEnabled: false` — on the people
path that is `contact_enrichment`, `enrich_contacts`, and `monitor_champions`. Resolve
`workspaceUuid` from `cargo-ai whoami`
(`workspace.uuid`) and resolve resource UUIDs from `cargo.state.json` or the matching get/list
command. Send a clickable URL per resource:

- Play: `https://app.getcargo.io/workspaces/<workspaceUuid>/plays/<playUuid>`
- Tool: `https://app.getcargo.io/workspaces/<workspaceUuid>/tools/<toolUuid>`

Do not ask for phase-two approval when any deployed resource link is missing or does not resolve.
The same message includes the approved fields, eligible population — split by play on the people
path — route counts, current unit
prices, and exact estimated credits. Its `Next step` asks the operator to review the disabled Cargo
resources and approve the run at that stated maximum cost. Until that approval, keep every play
disabled and make no paid enrichment call.

## Workflow and play boundary

`account_enrichment` is the reusable data component. Its workflow accepts a LinkedIn URL or handle
plus a domain, normalizes the LinkedIn value, calls one mutually exclusive provider route, and
returns the approved company-data schema. It has no CRM record id, CRM connector, fill-state policy,
or CRM write action.

`enrich_crm_account` is the play's per-row orchestration workflow. The checked example accepts the
CRM record id plus the current LinkedIn company ID, LinkedIn page, domain, name, website, and
employee count from that same `crm_accounts` row. The managed segment trigger has already enforced
identifier and freshness eligibility, so the workflow starts by calling `account_enrichment`, then
applies the approved per-field write policy and pushes the returned values to the CRM. HubSpot's
example matches `hs_object_id`. Salesforce matches `Id`. Attio matches the record id.

This is a compiled-node contract, not only a naming convention. `account_enrichment` uses
`defineWorkflow`: its first generated Branch ends rows with no identifier, and its next Branch sends
each eligible row to exactly one provider connector route. It contains no CRM connector node. The
play starts with one Tool node targeting `account_enrichment`, then runs the only CRM update. It
contains no provider connector node.

`enrich_accounts` is orchestration. It runs that workflow over `crm_accounts`
and owns its managed backing segment through `filter`. Do not declare a
separate segment. Do not introduce a native `accounts` unification to sit
between the play and the CRM write.

The people path repeats the same boundary. `contact_enrichment` accepts a LinkedIn profile URL or
handle plus an email, normalizes the LinkedIn value, and returns the approved person-data schema
with no CRM access. Its compiled graph starts with the identifier Branch; the URL route calls the
person enrichment directly, the email route calls the resolver, ends unresolved rows, and only
then calls the person enrichment — at most one full paid chain per row.

`enrich_crm_contact` starts with the tool call and owns one CRM update: fill approved blanks,
stamp freshness. `monitor_crm_champion` starts with the same tool call, reads the contact's
primary company record, and branches: same company fills blanks and sets
`primary_employment_status: Active`; no current company sets `Left` and keeps the association; a
different company finds the new company by LinkedIn company ID first and domain second, resolves
the target contact through the LinkedIn person identity — the row's record when no duplicate
exists — updates that one contact (association, title, status), and posts the structured
job-change alert to the approved Slack channel. When the new company is not in the CRM, the play
stamps a `partial` outcome, keeps the association, marks the departure, and the alert asks the
owner to create the company so the next cycle finishes the move — record creation is not part of
the checked example. No branch creates, merges, or deletes a contact.

The tool output schema and the play write mappings form one interface: every selected provider field
returned by a tool has its approved CRM destination in its play workflows. The plays
must invoke the tool handle instead of duplicating provider connector calls. If the interface
diverges, stop and reconcile it before sending any UI link.

A handle that already starts with `http` is used as the LinkedIn URL.
Otherwise it is prefixed — `https://www.linkedin.com/company/<handle>` for accounts,
`https://www.linkedin.com/in/<handle>` for contacts. Domain is the account fallback route; the
email resolver chain is the contact fallback route.

The account segment excludes rows without an identifier but includes populated stale rows; do not
add a destination fill-state condition there. The contact segments exclude rows without an
identifier and split on the confirmed customer status; `enrich_contacts` additionally requires at
least one blank starting-recommendation destination, and `monitor_champions` requires the primary
company link. Do not repeat identifier, freshness, or customer-status conditions as workflow
branches. For each field, apply the approved `fill_blanks` or `refresh_selected` policy. Numeric zero
counts as populated. `cargo_last_enriched_at` and the outcome stamp write only
after the provider result and the CRM update — `succeeded` on completed branches, `partial` when
a job change could not finish because the new company is missing. A failed provider call stamps
nothing.

Before every preview, fetch the applicable costs for the path:
`cargo-ai connection integration get linkedin` for
`integration.actions.enrichCompany.credits.costs`,
`integration.actions.enrichCompanyFromDomain.credits.costs`, and
`integration.actions.enrichProfile.credits.costs`, plus
`cargo-ai connection integration get FullEnrich` for
`integration.actions.reverseEmailLookup.credits.costs`. Cost the eligible
CRM rows with the current values and record when pricing was fetched.

## Verification

In this repository run `npm run validate`. In the consumer project:

1. Run `cargo-ai cdk types` after selecting the live CRM connector. On the people path, use the
   generated types to fix every `PLACEHOLDER` provider result path and the Slack `postMessage`
   payload before anything else.
2. From the copied skill folder, run `node --import tsx evals/contract.mjs` after adapting
   `infra/index.ts`. It must pass before the plan is reviewed.
3. Run `cargo-ai cdk check`.
4. Run `cargo-ai cdk plan` and inspect every resource and action payload.
5. Confirm the plan has one CRM model per audited object and no native `accounts` or `contacts`
   unification.
6. Confirm each compiled tool starts with an identifier Branch and contains no CRM action —
   `contact_enrichment`'s email route must end unresolved rows before the person enrichment.
   Confirm every play starts with one Tool node targeting its tool, contains no provider action,
   and that CRM actions exist only in plays; the champion play's four update branches each stamp
   the Cargo-owned fields, and exactly one moves the company association.
7. Deploy only after the phase-one approval explicitly authorizes disabled resource creation.
8. Show the operator direct Cargo UI links for every disabled play and tool, the approved field
   contract, exclusions, target counts per play, mappings, live action costs, exact estimated
   credits, pricing lookup time, and that every play stays disabled.
9. Run or enable only after the operator reviews that phase-two handoff and explicitly approves the
   stated population and maximum cost.

## Post-enrichment report

After the approved run completes, report:

- eligible, processed, written, and failed counts — per play on the people path
- before-and-after filled counts and fill rates for every approved CRM destination, and the final
  attribute coverage of the enriched segment
- champion outcomes: same-company refreshes, departures marked `Left`, job changes completed,
  job changes waiting on a missing company, and where each Slack alert went
- estimated credits, actual credits, and the variance
- failure groups with the recommended remediation
- direct Cargo UI links for every play and tool

End with one recommended `Next step`: remediate failures before continuing, approve recurring
daily coverage for rows entering the managed segments, or proceed to deduplication after matching
key coverage is healthy — account deduplication on `linkedin_company_id`, contact deduplication
on `linkedin_person_id`. Do not end the report with an open-ended offer.

Replace the write `matchingPropertyName` together with the workflow input and
play columns so the filter, the write match, and the extract all resolve the
same CRM record. Re-fetch pricing and re-preview costs before enabling the
schedule.

## Complete when

- the consumer file contains only the selected CRM action shapes
- `account_enrichment` and `contact_enrichment` are deployed workflow-backed tools with no CRM
  access
- each compiled tool graph starts with an identifier Branch and contains no CRM
  connector node; the contact tool's email route ends unresolved rows before the person
  enrichment
- every play for the audited path is disabled; each row workflow starts with one Tool node
  targeting its tool and contains no provider connector node; CRM actions exist only in plays
- `node --import tsx evals/contract.mjs` passes against the adapted template
- each play's model is its own CRM extract (`crm_accounts`, `crm_contacts`)
- every write matches the intended CRM record id
- the input, result schema, mappings, and per-field write policies match the approved field contract
- the account segment allows populated stale rows; the contact segments split on the confirmed
  customer status with the approved freshness windows
- fills use a CRM-native blank-only update flag or an explicit fresh-read guard; the champion
  job-change branch's refresh of association, title, and status is the recorded exception
- a job change updates the resolved existing contact, preserves the former relationship, and
  posts the structured alert — and never creates, merges, or deletes a contact
- `isEnabled: false`, `runCreationRule: noConcurrency`, daily scheduling, and
  `changeKinds: ["added"]` remain in the first plan for every play
- every disabled play and tool has a working direct Cargo UI link before run approval
- the operator approved the exact target and maximum estimated credits before execution
- the final report includes before-and-after field coverage, all outcomes — including champion
  outcomes and alert destinations — failures, actual credit
  variance, and a recommended next step
- no credential, customer data, or deploy command appears in the committed
  template
