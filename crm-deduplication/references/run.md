# Run CRM deduplication

Use this reference after the audit and disabled build pass. A deployed disabled play can still
mutate CRM records when manually run, so deployment approval and pilot approval are separate gates.

## Deploy disabled

After the operator approves the audit and authorizes a disabled build, run the checks from
`SKILL.md`, inspect the plan, and deploy with `isEnabled: false`. Resolve `workspaceUuid` from
`cargo-ai whoami` (`workspace.uuid`) and the play UUID from `cargo.state.json` or the matching list
command. Send the direct play URL:

`https://app.getcargo.io/workspaces/<workspaceUuid>/plays/<deduplicationPlayUuid>`

The handoff names the approved matching keys, protected fields, 60/25/15 score, automatic class,
survivor precedence, review owner, Slack channel, timeout, exact 15-row maximum population, and
current CRM and Slack action costs. Stop for explicit pilot approval.

## Run the pilot

Before the approved run:

1. Refresh the audit and target population from live CRM rows.
2. Re-read the selected CRM and Slack integration schemas and costs.
3. Confirm the play is disabled, `noConcurrency`, and limited to 15 rows.
4. Confirm `PLACEHOLDER_REVIEW_CHANNEL_ID` and protected-ID or parent-company placeholder slugs are
   gone.
5. Inspect the compiled graph and run `node --import tsx evals/contract.mjs`.
6. Ask the operator to approve the exact population and merge-capable policy.

Run only the approved rows. Monitor every workflow until it reaches a terminal outcome. A review
request is pending work, not a completed pilot.

## Verify and report

Report every `no_duplicates`, `source_missing_or_changed`, `merged_automatically`,
`merged_after_review`, and `review_declined_or_timed_out` outcome. Include source IDs, survivor ID,
score, conflict flags, reviewer when present, CRM response, failures, and the direct play link.

For every merge, re-read the surviving CRM record and confirm each child ID no longer resolves as
an independent company. Reconcile processed rows against terminal outcomes and unresolved reviews.
Count discrepancies are blockers.

End with one recommended `Next step`: fix weak identity coverage, remediate failed merges, review
declined clusters, or approve recurring deduplication after the surviving records are verified.

## Complete when

- the operator approved the disabled build and, separately, the exact merge-capable pilot
- the direct Cargo play link resolves
- current CRM and review action schemas and costs were checked before the pilot
- every enrolled row has a terminal outcome or a named unresolved review
- every merged survivor and absorbed child ID was verified in the CRM
- the report accounts for every search, score, review, merge, decline, timeout, exclusion, and error

