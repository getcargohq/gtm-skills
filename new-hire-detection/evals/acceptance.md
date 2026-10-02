# Acceptance

Walk every line before calling the pipeline done. Report each with its evidence: a command output,
a run link, or a CRM record link. A line that could not be checked is reported as unchecked, not
as passed.

## Search and approval

- [ ] The market (titles, industries, headcount, locations) came from the ICP in the workspace
      context, or was asked for because none existed and then written to `context/icp.md`.
- [ ] Every industry and region value is an id from the integration's autocompletes.
- [ ] Every title in `CURRENT_TITLE` is quoted, and the excluded words are listed.
- [ ] Every URL keeps `RECENTLY_CHANGED_JOBS`, `YEARS_AT_CURRENT_COMPANY` and
      `YEARS_IN_CURRENT_POSITION`.
- [ ] Each URL was counted with `searchPersonMetrics`, and each count is under 2,500 or the search
      was split by a facet that partitions the market.
- [ ] The live per-lead extraction price, the lookup time, and the cost of one sync were shown.
- [ ] The operator approved the search, the limit, the cadence and the cost per sync before any
      extraction.

## CRM shape

- [ ] The CRM is the system of record the operator named, and the play was adapted to it as a whole
      (connector, lookups, routing signal, contact key, task).
- [ ] No lookup uses `soqlQuery`.
- [ ] The routing signal is populated on the accounts it routes on, or routing was moved to deals.
- [ ] The LinkedIn identity fields exist, the person lookup reads them, and the stored URL shape
      is one of the four forms `infra/scripts/lookup.ts` searches.
- [ ] Account domains are stored in one of the forms `infra/scripts/lookup.ts` searches, or the
      missing form was added there.
- [ ] The operator chose one contact per person (default) or one per company.
- [ ] `csmOwnerProperty` names the portal's CSM field, or the operator confirmed the account owner
      is the CSM.
- [ ] The owner for new accounts is a real owner ID from the live owner list.
- [ ] The Find Email placeholder is replaced, and the tool's live inputs and output path match the
      call.

## Template and compiled graph

- [ ] `node --import tsx evals/contract.mjs` passes.
- [ ] `cargo-ai cdk types`, `cargo-ai cdk check` and `cargo-ai cdk plan` pass in the consumer
      project.
- [ ] The plan shows one model, one agent, one disabled play, and no duplicated connector or folder.
- [ ] The qualifier reads `icp.md` from the workspace context and has no CRM or model in reach.

## Pilot of ten

- [ ] The first deploy used `limit: 10` and no schedule.
- [ ] Ten rows landed, and their columns match the workflow input.
- [ ] The play was enabled and executed once; every one of the ten has a run.
- [ ] Each run is reported with its route, status, and CRM record links.
- [ ] A new-account run shows the qualifier's verdict and rationale; a declined company wrote
      nothing.
- [ ] No account the CRM already held was created again.
- [ ] Every task carries an owner (the CSM on customers) and is attached to the account and the
      contact; known accounts got the contact and no task.
- [ ] A person already on the account produced no email lookup and no task.
- [ ] A person found at another company was moved, not duplicated, and the task says so.
- [ ] A moved person with no new email no longer carries their previous employer's address. If the
      CRM ignored the empty value, the old address is still there: report it and clear it another
      way before opening up.
- [ ] Any route the ten did not reach is named as unverified, or was run on a chosen record.

## Opening up

- [ ] The operator approved opening up after reading the pilot report.
- [ ] `limit` and the cadence were set to the approved values and redeployed.
- [ ] The next sync created runs only for people new since the previous one.
- [ ] The report per sync lists extracted, added, runs by route and status, accounts, contacts and
      tasks created, companies declined, and spend against the estimate.
