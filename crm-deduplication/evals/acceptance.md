# CRM deduplication acceptance

## Skill boundary

- `crm-deduplication` is one root pipeline skill with `SKILL.md`, `README.md`, `infra/`, `references/`, and
  `evals/`.
- Accounts and contacts remain sibling resources in this one skill.
- It installs and operates without `crm-enrichment`.
- Supporting instructions contain no nested `SKILL.md`.
- No relative import leaves the skill folder.

## Audit and approval

- The audit reads the source CRM account and contact models without paid calls, review requests, or
  CRM writes.
- Identifier coverage, candidate counts, mutually exclusive classes, conflicts, protected IDs,
  generic/shared email risk, and survivor evidence agree across JSON, Markdown, and chat.
- Company name alone never creates or scores a candidate.
- Person name, job title, company association, or fuzzy similarity never creates or scores a
  contact candidate.
- The operator approves matching keys, protected fields, survivor precedence, automatic class, and
  manual-review destination before CDK adaptation.
- Deployment authorization and merge-capable pilot authorization are separate gates.

## Resources and graph

- The isolated plan contains two skill folders, `connector:crm`, `connector:slack`,
  `model:crm_accounts`, `model:crm_contacts`, `play:deduplicate_accounts`, and
  `play:deduplicate_contacts` only.
- No account or contact candidate staging model exists.
- Each play runs directly on its CRM model; its filter requires the CRM record ID and at least one
  supported identity key.
- The graph calls the selected CRM's live record-search action, retains the fresh source exactly
  once, normalizes evidence, runs one native Scoring node, and then selects the survivor.
- The checked score assigns LinkedIn company ID 60, LinkedIn URL 25, and non-generic domain 15.
- The automatic branch requires score at least 60, exact shared LinkedIn company ID, and no identity,
  protected-ID, or parent-subsidiary conflict.
- Contact scoring assigns 60 to exact LinkedIn person ID, exact LinkedIn person URL without
  person-ID conflict, exact non-generic email without LinkedIn conflict, and a transitive chain of
  those classes.
- The contact automatic branch applies LinkedIn identity and generic/shared email guards to every
  automatic class. Phone-only clusters never merge automatically.
- Direct contact search prepares normalized LinkedIn URL variants, then a second live search
  expands transitive clusters.
- Every non-automatic candidate reaches one native Human Review node. Approval reaches the reviewed
  CRM merge; decline or timeout reaches a no-write end.
- A source row missing from the fresh search stops before scoring as `source_missing_or_changed`.
- Each play has only automatic and human-approved CRM merge paths.
- Contact merge paths end after the native merge and never create post-merge update nodes.
- Contact normalization, enrichment, and association changes remain outside this deduplication
  workflow and require separate approval.
- Neither connector configures a cache, so every duplicate decision reads the CRM live.
- Both plays are disabled, use `noConcurrency`, and are limited to 15 CRM rows.

## Adaptation and execution

- `infra/` keeps connectors, ownership folders, models, plays, and typed scripts in separate files.
- The checked resources contain one HubSpot shape. Salesforce or Attio replaces that shape in place.
- Compatible CRM resources already in the consumer project are reused and duplicate declarations
  removed.
- Live generated types confirm the selected search, merge, and Human Review schemas.
- The Slack channel, protected-ID fields, parent-company fields, and contact identity fields are
  resolved before planning.
- `node --import tsx evals/contract.mjs`, `cargo-ai cdk types`, `cargo-ai cdk check`, and
  `cargo-ai cdk plan` pass in the consumer project.
- The operator approves each exact 15-row maximum pilot before any merge-capable run.
- The final report resolves contact survivors from the merge response or identity lookup, verifies
  every absorbed record, and accounts for all terminal outcomes.
