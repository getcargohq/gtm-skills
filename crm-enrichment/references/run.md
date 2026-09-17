# Run and report

Keep both plays disabled through build review. A paid run requires a separate operator approval
after the exact population and maximum credits are known.

## Before the pilot

1. Confirm that the audit field contract is approved.
2. Confirm that both Cargo-native tool UUIDs and live schemas replaced the placeholders.
3. Run typechecking, pipeline checks, the compiled graph contract, and `cargo-ai cdk plan`.
4. Confirm the contact plan has one play and only these three tool targets: Find Email, Find
   LinkedIn Profile from Email, and Contact LinkedIn Enrichment.
5. Confirm all plays are disabled and use `noConcurrency`.
6. Recount the mutually exclusive contact routes from the current model snapshot.
7. Fetch live unit prices and show the maximum credits per route and in total.
8. Ask the operator to approve the one-record probe and priced pilot.

## One-record write probe

Choose a reversible test record with at least one approved blank. Verify:

- the CRM record ID matches exactly one record
- the expected route calls only its gated tools
- existing business values remain unchanged
- approved blanks are filled
- successful freshness is stamped only after the CRM write
- the play reports the expected outcome

Restore only the probe's Cargo-owned operational stamps if the operator approved that cleanup. Do
not clear or overwrite provider-derived business values without explicit approval.

## Contact route probes

Use fixtures or safe live rows to verify all four states:

| State                         | Expected behavior                                                  |
| ----------------------------- | ------------------------------------------------------------------ |
| Email and LinkedIn            | Skip native tools, call custom enrichment, write blanks            |
| LinkedIn only                 | Call Find Email, call custom enrichment, write blanks              |
| Email only, resolver succeeds | Call profile resolver, call custom enrichment, write blanks        |
| Email only, resolver misses   | Call profile resolver, stop without custom enrichment or CRM write |
| Neither                       | No call and no write                                               |

The compiled workflow contains three mutually exclusive custom-tool call nodes because each
successful route is explicit. All three nodes target the same `contact_linkedin_enrichment`
resource.

## Run the approved population

Start only the approved pilot population. Monitor run status, connector failures, unresolved
identifiers, CRM write failures, and credits. Do not broaden the filters or rerun failed rows until
the operator understands whether another provider charge will occur.

After a successful pilot, request a separate decision before enabling recurring coverage. Keep the
schedule and freshness window shown in the plan.

## Final report

Report:

- direct links to each deployed play and custom tool
- eligible and processed records
- route counts for both identifiers, LinkedIn only, email only, and neither
- records written, unresolved, skipped, and failed
- before-and-after fill rate for every approved destination
- actual credits by tool and total, compared with the estimate
- confirmation that no existing business value was overwritten
- confirmation that unresolved rows did not receive successful freshness
- recommended next action and any remaining blocker

## Stop conditions

Stop the run and report the evidence if:

- a native tool's live schema differs from the adapted call
- a supposedly gated tool runs on the wrong route
- one CRM ID matches zero or multiple records
- an existing business value changes
- an unresolved row writes or receives successful freshness
- the actual paid-call count exceeds the approved route estimate
