# CRM deduplication acceptance

## Skill boundary

- `crm-dedup` is one root pipeline skill with `SKILL.md`, `README.md`, `infra/`, `references/`, and
  `evals/`.
- It installs and operates without `crm-enrichment`.
- Supporting instructions contain no nested `SKILL.md`.
- No relative import leaves the skill folder.

## Audit and approval

- The audit reads the source CRM account model without paid calls, review requests, or CRM writes.
- Identifier coverage, candidate counts, mutually exclusive classes, conflicts, protected IDs, and
  survivor evidence agree across JSON, Markdown, and chat.
- Company name alone never creates or scores a candidate.
- The operator approves matching keys, protected fields, survivor precedence, automatic class, and
  manual-review destination before CDK adaptation.
- Deployment authorization and merge-capable pilot authorization are separate gates.

## Resources and graph

- The isolated plan contains `connector:crm`, `connector:manual_review`, `model:crm_accounts`, and
  `play:deduplicate_accounts` only.
- No `account_duplicate_candidates` or other staging model exists.
- The play runs directly on `crm_accounts`; its filter requires the CRM record ID and at least one
  supported identity key.
- The graph calls the selected CRM's live record-search action, retains the fresh source exactly
  once, normalizes evidence, runs one native Scoring node, and then selects the survivor.
- The checked score assigns LinkedIn company ID 60, LinkedIn URL 25, and non-generic domain 15.
- The automatic branch requires score at least 60, exact shared LinkedIn company ID, and no identity,
  protected-ID, or parent-subsidiary conflict.
- Every non-automatic candidate reaches one native Human Review node. Approval reaches the reviewed
  CRM merge; decline or timeout reaches a no-write end.
- A source row missing from the fresh search stops before scoring as `source_missing_or_changed`.
- Exactly two CRM merge nodes exist: automatic and human-approved. No other path writes to the CRM.
- Connector cache duration is 15 days.
- `deduplicate_accounts` is disabled, uses `noConcurrency`, and is limited to 15 CRM rows.

## Adaptation and execution

- The checked file contains one HubSpot shape. Salesforce or Attio replaces that shape in place.
- Compatible CRM resources already in the consumer project are reused and duplicate declarations
  removed.
- Live generated types confirm the selected search, merge, and Human Review schemas.
- The Slack channel, protected-ID fields, and parent-company fields are resolved before planning.
- `node --import tsx evals/contract.mjs`, `cargo-ai cdk types`, `cargo-ai cdk check`, and
  `cargo-ai cdk plan` pass in the consumer project.
- The operator approves the exact 15-row maximum pilot before any merge-capable run.
- The final report verifies every survivor and child ID and accounts for all terminal outcomes.

