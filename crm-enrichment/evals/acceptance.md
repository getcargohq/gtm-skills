# Acceptance

Walk every line for the path being deployed. If the operator requested both account and contact
enrichment, both paths must pass independently. Evidence from one path does not approve the other.

## Path 1: Account enrichment

### Audit and approval

- [ ] The live CRM company schema, record ID field, blank semantics, and write action were verified.
- [ ] The live LinkedIn company enrichment schemas were inspected for both the LinkedIn URL and
      domain routes.
- [ ] The field-contract table contains one decision row per provider property, including source,
      output type, CRM destination, transformation, current fill rate, write policy, and operator
      decision.
- [ ] Genuine customer-managed duplicate properties were reported separately. CRM system and
      generated properties were not presented as duplicates.
- [ ] The operator approved the complete account field contract before CDK adaptation or paid calls.
- [ ] Eligible account counts are mutually exclusive between the LinkedIn URL and domain routes.
- [ ] Live unit prices, the lookup timestamp, action slugs, eligible counts, and maximum account
      spend were recorded before run approval.
- [ ] The operator approved disabled deployment separately from the paid account pilot.

### Template and compiled graph

- [ ] `crm_accounts` is a direct CRM company extract and carries the CRM record ID used by the write.
- [ ] No native account unification sits between the model and CRM write.
- [ ] `account_enrichment` accepts company identifiers, normalizes LinkedIn handles, and has no CRM
      record ID, connector access, or write action.
- [ ] The compiled tool graph first ends rows with no identifier, then chooses exactly one provider
      route. LinkedIn URL is attempted before domain fallback.
- [ ] A LinkedIn handle already beginning with `http` is used as-is; another handle is prefixed with
      the canonical company profile URL.
- [ ] `enrich_accounts` starts with one Tool node targeting `account_enrichment`, contains no direct
      LinkedIn connector action, and owns the only CRM update.
- [ ] The play write matches the audited CRM record ID (`hs_object_id` in the HubSpot example).
- [ ] Every approved business field uses a CRM-native blank-only update or an equivalent fresh-read
      guard that preserves populated values, including numeric zero.
- [ ] `cargo_last_enriched_at` and `cargo_enrichment_status=succeeded` are written only on the
      successful CRM write path. Provider and CRM errors remain failed workflow runs.
- [ ] The play filter requires a company identifier and null-or-stale freshness. It does not require
      a blank destination, so an explicitly approved refresh policy can re-enrich populated fields.
- [ ] The play is disabled, uses `noConcurrency`, evaluates daily, and creates runs for records added
      to its managed segment.
- [ ] No standalone segment duplicates the play filter.

### Validation and rollout

- [ ] `npm run typecheck`, `node scripts/check-pipelines.mjs`, and
      `node --import tsx crm-enrichment/evals/contract.mjs` pass.
- [ ] `cargo-ai cdk types`, `cargo-ai cdk check`, and `cargo-ai cdk plan` pass in the consumer project.
- [ ] The plan shows one account model, one account enrichment tool, and one disabled account play.
- [ ] The account play and tool have working direct Cargo UI links before paid-run approval.
- [ ] A one-record write probe passed without changing a populated business value.
- [ ] The operator approved the exact account population and maximum spend before execution.
- [ ] The final account report includes eligible, processed, written, skipped, and failed counts;
      before-and-after fill rates per approved field; actual spend against estimate; and direct
      Cargo links.
- [ ] No credential, customer data, or deploy command appears in the committed template.

## Path 2: Contact enrichment

### Audit and approval

- [ ] The live CRM contact schema, record ID field, blank semantics, and write action were verified.
- [ ] The live LinkedIn profile enrichment schema was inspected.
- [ ] Cargo-native Find Email and Find LinkedIn Profile from Email were instantiated and their UUIDs,
      accepted inputs, output paths, and live unit prices were recorded.
- [ ] The contact field-contract table contains one decision row per provider property, including
      source, output type, CRM destination, transformation, current fill rate, write policy, and
      operator decision.
- [ ] Route counts are mutually exclusive for both identifiers, LinkedIn only, email only, and
      neither identifier.
- [ ] The operator approved the complete contact field contract before CDK adaptation or paid calls.
- [ ] The operator approved disabled deployment separately from the paid contact pilot.

### Template shape and gating

- [ ] `crm_contacts` is a direct CRM contact extract and carries the CRM record ID used by the write.
- [ ] There is one contact play: `enrich_contacts`.
- [ ] The play targets exactly three tool resources: Cargo-native Find Email, Cargo-native Find
      LinkedIn Profile from Email, and custom `contact_linkedin_enrichment`.
- [ ] `contact_linkedin_enrichment` calls one LinkedIn profile enrichment action and has no CRM
      record ID, connector access, or write action.
- [ ] A row with email and LinkedIn skips both native tools and calls custom enrichment.
- [ ] A LinkedIn-only row calls Find Email, then custom enrichment.
- [ ] An email-only row calls Find LinkedIn Profile from Email, then custom enrichment only when a
      profile resolves.
- [ ] An unresolved email-only row stops without custom enrichment, CRM write, or successful
      freshness.
- [ ] A row with neither identifier makes no tool call and no CRM write.
- [ ] The compiled graph proves these gates. Explicit successful branches may compile multiple call
      nodes, but every custom call targets the same `contact_linkedin_enrichment` resource.
- [ ] The play contains no direct LinkedIn connector action.
- [ ] No customer split, movement verdict, relationship mutation, note creation, or alert connector
      is present.

### Filters and writes

- [ ] Eligibility requires email or LinkedIn, null-or-stale freshness, and at least one approved
      blank destination.
- [ ] Every blank string condition pairs `isNull` with `isEmpty`.
- [ ] Every successful route updates the triggering contact by CRM record ID.
- [ ] `email`, `linkedin_person_id`, `linkedin_profile_url`, and `jobtitle` use blank-only writes.
- [ ] `cargo_last_enriched_at` and `cargo_enrichment_status=succeeded` are written only on successful
      CRM write paths.
- [ ] The play never creates, merges, or deletes a contact.
- [ ] The play is disabled, uses `noConcurrency`, evaluates daily, and creates runs for records added
      to its managed segment.
- [ ] No standalone segment duplicates the play filter.

### Validation and rollout

- [ ] `npm run typecheck`, `node scripts/check-pipelines.mjs`, and
      `node --import tsx crm-enrichment/evals/contract.mjs` pass.
- [ ] `cargo-ai cdk types`, `cargo-ai cdk check`, and `cargo-ai cdk plan` pass in the consumer project.
- [ ] The plan shows one contact model, the three intended tool targets, and one disabled contact
      play.
- [ ] The contact play and custom tool have working direct Cargo UI links before paid-run approval.
- [ ] A one-record write probe passed without changing a populated business value.
- [ ] The operator approved the exact contact population and maximum spend before execution.
- [ ] The final contact report includes route, processed, written, unresolved, skipped, and failed
      counts; before-and-after fill rates per approved field; actual spend against estimate; and
      direct Cargo links.
- [ ] No credential, customer data, or deploy command appears in the committed template.
