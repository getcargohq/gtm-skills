# CRM deduplication acceptance

## Skill boundary

- `crm-deduplication` is one root pipeline skill with `SKILL.md`, `README.md`, `infra/`,
  `references/`, and `evals/`.
- Accounts and contacts stay in the same root skill and slug.
- It installs and operates without `crm-enrichment`.
- Supporting instructions contain no nested `SKILL.md`.
- No relative import leaves the skill folder.

## Audit and approval

- The audit reads source CRM account and contact models without paid calls, review requests, or CRM
  writes.
- Account identifier coverage, candidate counts, mutually exclusive classes, conflicts, protected
  IDs, and survivor evidence agree across JSON, Markdown, and chat.
- Contact identifier coverage, unique duplicate groups, affected contacts, identifier-specific
  group counts, high-confidence groups, low-confidence groups, conflicts, generic/shared email
  counts, and canonical evidence agree across JSON, Markdown, and chat.
- Contact phone normalization covers explicit international numbers, `00` prefixes, NANP, French
  trunk-prefix numbers, and UK trunk-prefix numbers from the first audit.
- Contact URL audit normalization and runtime search agree through the deterministic LinkedIn URL
  variant step.
- Company name alone never creates or scores an account candidate.
- Person name, job title, company association, or fuzzy person similarity never creates or scores a
  contact candidate.
- The operator approves matching keys, protected fields, generic/shared email definition, survivor
  precedence, automatic classes, and manual-review behavior before CDK adaptation.
- Low-confidence contact groups are sent to Human Review only when the operator enables that path;
  otherwise they are left untouched.
- Deployment authorization and merge-capable pilot authorization are separate gates.

## Resources and graph

- The isolated plan contains `connector:crm`, `connector:manual_review`, `model:crm_accounts`,
  `model:crm_contacts`, `play:deduplicate_accounts`, and `play:deduplicate_contacts` only.
- No `account_duplicate_candidates`, `contact_duplicate_candidates`, or other staging model exists.
- `deduplicate_accounts` runs directly on `crm_accounts`; its filter requires the CRM record ID and
  at least one supported account identity key.
- `deduplicate_contacts` runs directly on `crm_contacts`; its filter requires the CRM record ID and
  at least one supported contact identity key.
- The account graph calls the selected CRM's live company-search action, retains the fresh source
  exactly once, normalizes evidence, runs one native Scoring node, and then selects the survivor.
- The contact graph calls the selected CRM's live contact-search action, retains the fresh source
  exactly once, prepares LinkedIn URL search variants, expands transitive matches with a second live
  contact search, normalizes evidence, runs one native Scoring node, and then prepares the canonical
  Contact, secondary IDs, serial merge steps, and non-empty write-back mappings.
- The checked account score assigns LinkedIn company ID 60, LinkedIn URL 25, and non-generic domain
  15.
- The checked contact score assigns 60 to each high-confidence class: exact LinkedIn person ID,
  exact LinkedIn person URL without person-ID conflict, and exact non-generic email without
  LinkedIn conflict, plus transitive high-confidence chains across those classes.
- The account automatic branch requires score at least 60, exact shared LinkedIn company ID, and no
  identity, protected-ID, or parent-subsidiary conflict.
- The contact automatic branch requires score at least 60 and one of the three approved
  high-confidence classes.
- Phone-only, generic/shared email, conflicting LinkedIn person IDs, and conflicting LinkedIn
  identity never merge automatically.
- Pairwise transitive high-confidence contact chains merge into one canonical Contact without
  reselecting between secondaries.
- Low-confidence contact groups reach native Human Review when enabled and
  `low_confidence_not_reviewed` when review is disabled.
- Contact Human Review cards show one formatted line per record and include the required Slack
  config keys.
- Optional AI evidence can add a priced same-person summary to the review card only; it never
  selects the canonical Contact or authorizes a merge.
- Approval reaches the reviewed CRM merge; decline or timeout reaches a no-write end.
- A source row missing from the fresh search stops before scoring as `source_missing_or_changed`.
- Account CRM merge nodes exist only on automatic and human-approved paths.
- Contact CRM merge nodes exist only on automatic and human-approved paths.
- Contact CRM update nodes exist only after automatic and human-approved contact merges.
- Contact write-back targets the canonical Contact and maps only non-empty approved values for
  email, phone, LinkedIn URL, LinkedIn person ID, job title, and primary associated company ID.
- Connector cache duration is 15 days.
- Both deduplication plays are disabled, use `noConcurrency`, and are limited to 15 CRM rows.

## Adaptation and execution

- The checked file contains one HubSpot shape. Salesforce or Attio replaces that shape in place.
- Compatible CRM resources already in the consumer project are reused and duplicate declarations
  removed.
- Live generated types confirm the selected search, merge, update, and Human Review schemas.
- The Slack channel, protected-ID fields, parent-company fields, and contact identity fields are
  resolved before planning.
- The Cargo app is added to the dedicated Slack review channel before build.
- `node --import tsx evals/contract.mjs`, `cargo-ai cdk types`, `cargo-ai cdk check`, and
  `cargo-ai cdk plan` pass in the consumer project.
- The operator approves the exact 15-row maximum pilot for each selected play before any
  merge-capable run.
- Multi-contact groups merge every secondary Contact into one canonical Contact without reselecting
  the canonical record.
- HubSpot contact merge verification keys on matching identity resolving to exactly one Contact,
  not on the pre-merge canonical record ID surviving.
- The final report verifies every survivor and child identity, verifies contact write-back, and
  accounts for all terminal outcomes.
