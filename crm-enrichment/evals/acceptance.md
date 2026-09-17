# Acceptance checklist

## Audit and approval

- [ ] The live CRM object schemas, record ID fields, blank semantics, and write action were verified.
- [ ] The live LinkedIn company and profile enrichment schemas were verified.
- [ ] Find Email and Find LinkedIn Profile from Email were instantiated and their UUIDs, inputs,
      outputs, and unit prices were recorded.
- [ ] The operator approved one decision row per provider field, including destination, type,
      transformation, write policy, and cost.
- [ ] The operator approved disabled deployment separately from the paid pilot.

## Account path

- [ ] `account_enrichment` gates missing identifiers, chooses exactly one provider route, and has no
      CRM access.
- [ ] `enrich_accounts` calls `account_enrichment`, owns the CRM write, fills approved blanks only,
      and stamps freshness after a successful write.

## Contact shape

- [ ] There is one contact play: `enrich_contacts`.
- [ ] The play targets exactly three tool resources: Cargo-native Find Email, Cargo-native Find
      LinkedIn Profile from Email, and custom `contact_linkedin_enrichment`.
- [ ] `contact_linkedin_enrichment` calls one LinkedIn profile enrichment action and has no CRM
      access.
- [ ] No customer split, movement verdict, relationship mutation, note creation, or alert connector
      is present.

## Contact gating

- [ ] A row with email and LinkedIn skips both native tools and calls custom enrichment.
- [ ] A LinkedIn-only row calls Find Email, then custom enrichment.
- [ ] An email-only row calls Find LinkedIn Profile from Email, then custom enrichment only when a
      profile resolves.
- [ ] An unresolved email-only row stops without custom enrichment, CRM write, or successful
      freshness.
- [ ] A row with neither identifier makes no tool call and no CRM write.
- [ ] The compiled graph, not only the source, proves these gates.

## Filters and writes

- [ ] Eligibility requires email or LinkedIn, null-or-stale freshness, and at least one approved
      blank destination.
- [ ] Every blank string condition pairs `isNull` with `isEmpty`.
- [ ] Every successful route updates the triggering contact by CRM record ID.
- [ ] `email`, `linkedin_person_id`, `linkedin_profile_url`, and `jobtitle` use blank-only writes.
- [ ] `cargo_last_enriched_at` and `cargo_enrichment_status=succeeded` are written only on successful
      CRM write paths.
- [ ] The play contains no direct LinkedIn connector action.

## Validation and rollout

- [ ] `npm run typecheck` passes.
- [ ] `node scripts/check-pipelines.mjs` passes.
- [ ] `node --import tsx crm-enrichment/evals/contract.mjs` passes.
- [ ] `cargo-ai cdk plan` was reviewed and all plays were deployed disabled.
- [ ] The one-record write probe passed without changing an existing business value.
- [ ] The operator approved the exact pilot population and maximum credits.
- [ ] The report includes route, written, unresolved, failed, fill-rate, and credit counts plus direct
      Cargo links.
