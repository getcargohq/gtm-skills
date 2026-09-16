# Acceptance

Walk every line. A checked template with no warmed fleet behind it is incomplete: deploying cleanly
and never starting warm-up is the normal failure of this skill.

## Sizing and quote

- Before any question, the agent reports the existing fleet from a live
  `cargo-ai mailboxManagement mailbox list`, grouped by domain.
- The primary domain is derived from the signed-in address and confirmed in the plan. The agent does
  not ask for it.
- Senders are derived from workspace members and presented for confirmation with real first and last
  names. The agent does not ask the operator to retype names the workspace holds.
- Exactly one sizing question is asked: the target daily send volume at steady state.
- The domain and mailbox counts are derived from that number and the recommended three mailboxes per
  domain, and the agent shows the arithmetic rather than asserting the result.
- Candidate names are presented with availability and price from a live
  `domainManagement/domains/search` call, one row per name. No name is presented unchecked.
- A name returning `priceCredits: null` is treated as unavailable, not as free.
- Where the operator supplies their own list, pasted or as a CSV, generation is skipped and the
  availability check and spend approval still run on every name.
- The quote separates one-time registration from recurring monthly mailbox cost, and multiplies the
  recurring figure out to a year.
- Mailbox pricing comes from a live `cargo-ai mailboxManagement pricing get` at quote time, not from
  a figure written in any file.
- The agent states that a mailbox charge recurs monthly until removal and that there is no pause.
- The phase ends at an explicit approval of the exact domain list and the exact spend. Silence does
  not approve the generated names.
- No domain is registered and no mailbox is created during this phase.

## Template and plan

- `node --import tsx evals/contract.mjs` passes against the adapted example.
- The primary domain appears as `redirectUrl` and does not appear in the domain list.
- Every domain carries `dmarcEmail` and `dmarcPolicy`, and no domain declares `dnsRecords`.
- A domain or mailbox the workspace already owns is `adopt: true`, never a second registration.
- The mailbox count equals domains times senders, and the grid is full.
- Every mailbox carries a real first name, last name, signature, and the mailbox folder.
- One local-part shape is used across the whole fleet.
- Mailbox slugs are derived from sender and domain, with dots replaced, so a re-plan shows a diff
  rather than a teardown and rebuild.
- `cargo-ai cdk types && cargo-ai cdk check && cargo-ai cdk plan` all pass, and the diff is shown to
  the operator before deploy.

## Provisioning

- Deploy runs only under the phase-one authorization.
- The agent polls until no mailbox reports `pending`, rather than sleeping a fixed time or trusting
  the deploy's exit code.
- Every mailbox in the fleet reports `status: active` before warm-up is attempted.

## Warm-up

- Warm-up is started on every active mailbox in the fleet. This step is never skipped.
- No `start-warmup` is issued against a mailbox still reporting `pending`.
- Mailboxes outside this fleet are not touched, including any that were deliberately paused.
- Verification is a count of `status` and `warmupStatus` across the fleet, not a script exit code.
- Any mailbox left at `warmupStatus: disabled` is reported as not ramping, whatever the run
  reported.
- `stop-warmup` is not used to pause a mailbox.

## Report

- The report names the fleet size, the daily ceiling at full ramp, and the calendar date that
  ceiling arrives.
- The report states that the ramp is a ceiling and not a target.
- The one-time and recurring costs are restated against the approved quote.
