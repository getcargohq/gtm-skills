# Run CRM deduplication

Use this reference after the audit and disabled build pass. A deployed disabled play can still
mutate CRM records when manually run, so deployment approval and pilot approval are separate gates.

## Deploy disabled

After the operator approves the audit and authorizes a disabled build, run the checks from
`SKILL.md`, inspect the plan, and deploy with `isEnabled: false`. Resolve `workspaceUuid` from
`cargo-ai whoami` (`workspace.uuid`) and play UUIDs from `cargo.state.json` or the matching list
command. Send the direct play URLs:

- Accounts: `https://app.getcargo.io/workspaces/<workspaceUuid>/plays/<accountPlayUuid>`
- Contacts: `https://app.getcargo.io/workspaces/<workspaceUuid>/plays/<contactPlayUuid>`

The handoff names the approved matching keys, protected fields, score policy, automatic classes,
contact generic/shared email rule, canonical-record precedence, low-confidence contact review
policy, review owner, Slack channel, timeout, exact 15-row maximum population per selected play,
and current CRM and Slack action costs. Stop for explicit pilot approval.

When Human Review is enabled, confirm the review destination is a dedicated ops/review channel and
that the Cargo Slack app has been added to it before build. Do not default to the customer's
busiest Slack channel.

## Run the pilot

Before the approved run:

1. Refresh the audit and target population from live CRM rows.
2. Re-read the selected CRM and Slack integration schemas and costs.
3. Confirm each selected play is disabled, `noConcurrency`, and limited to 15 rows.
4. Confirm `PLACEHOLDER_REVIEW_CHANNEL_ID` and property placeholder slugs are gone where needed.
5. Inspect the compiled graph and run `node --import tsx evals/contract.mjs`.
6. Ask the operator to approve the exact population and merge-capable policy.

Run only the approved rows. Monitor every workflow until it reaches a terminal outcome. A review
request is pending work, not a completed pilot.

For contact groups with more than two records, merge every secondary into the same canonical
Contact. Do not select a new canonical Contact between secondary merges. After the native CRM merge
completes, write back only approved non-empty people values prepared before the merge: email, phone,
LinkedIn URL, LinkedIn person ID, job title, and primary associated company ID.

## Verify and report

Report every `no_duplicates`, `source_missing_or_changed`, `merged_automatically`,
`merged_after_review`, `review_declined_or_timed_out`, and `low_confidence_not_reviewed` outcome.
Include source IDs, survivor ID, score, conflict flags, review policy, reviewer when present, CRM
response, contact write-back mappings, failures, and the direct play links.

For every account merge, re-read the surviving CRM record and confirm each child ID no longer
resolves as an independent company. For every contact merge, verify by identity instead of stored
record ID: re-search the approved contact matching keys and confirm they resolve to exactly one
Contact. HubSpot can mint a new Contact record ID during merge, so a missing stored canonical ID is
not by itself a failed merge. Confirm the surviving Contact keeps the expected associations and that
post-merge write-back touched only the approved non-empty people fields. Reconcile processed rows
against terminal outcomes and unresolved reviews. Count discrepancies are blockers.

The contact completion copy is:

`We merged {{duplicate_records_merged}} duplicate Contact records into {{canonical_contacts_retained}} canonical Contacts.`

Results must include contacts analyzed, duplicate groups identified, duplicate records merged,
canonical Contacts retained, low-confidence groups requiring review, low-confidence groups left
untouched, failed merges, and failed write-backs. If the operator wants to share the results on
Slack, send the verified report summary only; do not deploy an additional Slack resource for
results sharing.

End with one recommended `Next step`: fix weak identity coverage, remediate failed merges or
write-backs, review declined clusters, approve low-confidence review, or approve recurring
deduplication after surviving records are verified.

## Complete when

- the operator approved the disabled build and, separately, the exact merge-capable pilot
- the direct Cargo play links resolve
- current CRM and review action schemas and costs were checked before the pilot
- the Cargo app was added to the dedicated Slack review channel before any review card was sent
- every enrolled row has a terminal outcome or a named unresolved review
- every merged survivor and absorbed child ID was verified in the CRM
- HubSpot contact merges were verified by matching-key identity resolving to one Contact, not by
  assuming the pre-merge canonical record ID survived
- contact write-back was verified on every canonical Contact after a guarded merge
- the report accounts for every search, score, review, merge, write-back, decline, timeout,
  exclusion, and error
