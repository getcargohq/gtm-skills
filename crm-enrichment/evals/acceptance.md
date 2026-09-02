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
- On the people path, the provider person ID is in the starting recommendation the same way, with
  the LinkedIn profile URL and job title; work email, phone, and email validation appear as
  optional candidates with their own paid routes, never as silent defaults.
- The contact audit covers work email, phone, LinkedIn profile URL, LinkedIn person ID, job
  title, and the primary company link, plus the company-side domain, LinkedIn identifiers, and
  customer status.
- The audit detects the customer-status mapping — live property, exact values, primary
  relationship only — and holds it `pending_operator_confirmation` until the operator confirms;
  both contact play filters use the confirmed mapping.
- The operational-field audit reuses an equivalent existing property when one exists, recommends
  the canonical one on usage and fill-rate evidence, and marks missing ones for approved
  creation; it never creates a second duplicate property.
- The audit records every live LinkedIn output as included or excluded, with destination, types,
  transformation, write policy, and reason where applicable.
- JSON, Markdown, and chat agree on property candidates, gaps, route counts, and costs.
- Unit costs come from current `cargo-ai connection integration get` responses for every billed
  action on the audited path — `linkedin` for the company actions and `enrichProfile`,
  `FullEnrich` for `reverseEmailLookup` — with the
  lookup timestamp, CLI version, action slugs, and applicable cost entries recorded.
- Credit math uses the fetched unit costs; the contact email route prices the resolver plus the
  person enrichment as one chain.
- Route counts are mutually exclusive and count eligible CRM rows on the connected extract after
  the field contract is approved — for contacts, split between `enrich_contacts` and
  `monitor_champions`.
- Primary destinations have live type and fill-rate evidence.
- No paid provider call or CRM write occurs during audit.

## Guided handoff

- Every substantive agent message names the current phase and ends with a `Next step` containing one
  concrete decision or action, what it unlocks, and what remains blocked.
- Phase one ends with the audit and enrichment recommendation — on the people path including the
  confirmed customer-status mapping, the operational-field decisions, and the champion alert
  channel — then asks for approval of the full
  field contract and authorization to build and deploy disabled resources.
- Phase two occurs only after that approval. The agent deploys the tool and every play for the
  audited path with each play
  disabled, sends a working direct Cargo UI link for each, and shows the exact eligible population
  per play,
  route counts, unit costs, and total estimated credits.
- Phase two ends by asking the operator to review the links and approve the run at the stated maximum
  cost. No paid enrichment call or enablement occurs before that approval.
- Phase three reports before-and-after fill rates per approved destination, all processed outcomes
  — including champion job-change outcomes and where each alert went —
  failures, actual credits against estimate, direct Cargo links, and one recommended next step.
- In-progress messages that need no decision say `No action needed` and identify the next checkpoint.

## CDK template

- The agent installed and read `cargo-cdk` before auditing or adapting the template.
- `infra/index.ts` is the only infrastructure source file.
- The consumer file contains only the selected CRM connector and action shapes.
- `account_enrichment` is a workflow-backed Cargo tool that accepts provider identifiers, normalizes
  them, and returns enriched company data. It has no CRM connector, CRM record id, or CRM write.
- The compiled `account_enrichment` graph starts with a code-generated Branch that ends rows with no
  identifier. A second Branch selects one mutually exclusive provider route, and the tool contains
  no CRM connector node.
- `enrich_accounts` is the disabled play. Its row workflow starts with exactly one Tool node
  targeting `account_enrichment`, applies the approved per-field write policy, and owns the only CRM
  update action.
- No play duplicates the provider connector calls implemented by its tool, and no tool
  duplicates the CRM reads or writes implemented by the plays.
- `node --import tsx evals/contract.mjs` passes against the adapted compiled graphs.
- Exactly one CRM model per audited object exists (`crm_accounts`, `crm_contacts` in the
  example). Each play uses its own.
- There is no native `accounts` or `contacts` unification.
- Freshness, fill-state, and the customer-status property are columns on the extracts.
- Every write matches the audited CRM record id (`hs_object_id` in the HubSpot example).
- `enrich_accounts`'s managed segment trigger excludes rows with no identifier and allows
  populated stale
  rows. Destination fill-state is not an eligibility condition there, and no row workflow
  repeats identifier, freshness, or customer-status conditions as branches.
- The workflow input, result schema, write mappings, and per-field write policies cover exactly the
  approved field contract.
- LinkedIn URL is attempted before the fallback route — domain for accounts, the email resolver
  for contacts. A handle that is already an `http` URL is used
  as-is. A row takes at most one paid route; the contact email route is the one full paid chain,
  and an unresolved email ends before the person enrichment.
- Fill-blanks uses a CRM-native conditional update or a fresh-read guard that preserves populated
  values, including numeric zero.
- `cargo_last_enriched_at` and the outcome stamp write only after a provider
  result and a CRM update — `succeeded` on completed branches, `partial` when a job change waits
  on a missing company. A failed provider call does not stamp freshness.
- Provider or CRM connector errors remain failed workflow runs.
- `contact_enrichment` is a workflow-backed Cargo tool that accepts a LinkedIn profile URL or
  handle plus an email, normalizes the profile URL, and returns enriched person data. It has no
  CRM connector, CRM record id, or CRM write.
- The compiled `contact_enrichment` graph starts with a code-generated Branch that ends rows with
  neither identifier. The URL route calls the person enrichment directly; the email route calls
  the resolver, branches on its result, and only a resolved row continues into the person
  enrichment.
- `enrich_contacts` fills approved blanks with `skipIfExist` and stamps freshness in its only CRM
  update. Its trigger requires an identifier, the non-customer side of the confirmed mapping,
  null-or-six-month freshness, and at least one blank starting-recommendation destination — the
  recorded deviation from the account path's no-fill-state rule, removed only under an approved
  refresh policy.
- `monitor_champions`'s trigger requires an identifier, the customer side of the confirmed
  mapping, the primary company link, and null-or-30-day freshness. Its row workflow reads the
  primary company, compares LinkedIn company ID first and domain second, and never treats a work
  email or its domain as identity or proof of a move.
- On a job change, the champion play finds the new company by LinkedIn company ID then domain,
  resolves the target contact through the LinkedIn person identity (falling back to the
  triggering row), updates that one contact — association, title, employment status — preserves
  the former relationship, and posts the structured alert to the approved Slack channel. Exactly
  one write moves the association; the title refresh there is deliberate. When the new company is
  missing, the play stamps `partial`, keeps the association, and the alert says what to create.
  No branch creates, merges, or deletes a contact.
- The two contact play filters are the customer-status split: their populations are disjoint and
  express the two refresh cadences. No standalone `defineSegment` exists.
- Every disabled play evaluates daily, creates runs only for rows added to its managed segment,
  and uses `noConcurrency`.
- The provider result paths marked `PLACEHOLDER`, the Slack channel id, and the `postMessage`
  payload are resolved from live schemas before deploy.
- `cargo-ai cdk types`, `cargo-ai cdk check`, and `cargo-ai cdk plan` pass in the consumer project.
- The plays and tools are deployed disabled only after phase-one approval, and their direct Cargo
  UI links resolve before the phase-two review request.

## Repository isolation

- This is one root skill. Its supporting Markdown files live under `references/`, and no
  nested `SKILL.md` exists.
- No CRM-specific template directories remain.
- The template contains no credential, deployment command, or customer data.
- No relative import leaves the skill.
