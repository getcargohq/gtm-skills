# Running the cockpit

The pilot is one claim and one send to an address you own. Nothing goes to a prospect until both
have been read by a person.

## Queue

The Hot accounts query is `infra/apps/cockpit/src/lib/queries.ts` (`hotAccountsQuery`, and
`signalsQuery` for the Signals column). Every account read goes through Unify Accounts:

| Table                   | Owned by                     | Columns read                                                                                     |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `object.accounts`       | Cargo (Unify Accounts)       | `id`, `domain`, `ai_ark___tam_companies___*` (name, LinkedIn, description, firmographics)         |
|                         | account-scoring              | `custom__tier`, `custom__tier_reason`, `custom__tier_evidence_url`, `custom__tiered_at`          |
|                         | readiness-scoring            | `metric__readiness_score`, `computed__readiness_stage`                                           |
| `object.account_events` | readiness-scoring            | `account_id`, `properties`, `event_name`, `model_slug`, `occurred_at`, `computed__readiness_contribution` |
| `object.cockpit_claims` | this skill                   | `account_domain`, `status`, `parked_until`                                                       |
| `object.gtm_activities` | this skill and others        | joined on `account_id = accounts.gtm_accounts___id`, for the Activity tab                        |

The tier is on Unify Accounts only with account-scoring's `unified-account` variation; by default
it writes `tam_companies`. tam-building's columns show on Unify Accounts as
`<dataset>___<model>___<column>`, custom columns excluded. Confirm them:

```sh
cargo-ai storage model get <unify-accounts-uuid>
```

Then run the query by hand, with `cockpit_claims` removed from it if the model is not deployed
yet, and read the rows:

```sh
cargo-ai storage query execute "<hotAccountsQuery>"
```

An empty result here is an empty Hot accounts page in the app, not an error. The usual causes: no
account is `ready_now` or `warming` yet (readiness-scoring's thresholds), the tier is still on
`tam_companies` rather than Unify Accounts, or tam-building's dataset slug differs from `ai_ark`.

## Pilot claim

1. Open the app (`cargo-ai hosting app list` gives the URL) and sign in as a rep listed in
   `infra/members/reps.ts`.
2. Claim one account from Hot accounts. The page moves to the account and says it is sourcing.
   To pilot from the terminal instead, run the claim tool directly (the tool's uuid is in
   `cargo-ai orchestration tool list`):

```sh
cargo-ai orchestration action execute \
  --action '{"kind":"tool","toolUuid":"<claim-tool-uuid>"}' \
  --data '{"account_domain":"<domain>","account_name":"<name>","rep_email":"<your login>","rep_first_name":"<first name>","account_context":"Fit tier B"}' \
  --wait-until-finished
```

3. Follow the run:

```sh
cargo-ai orchestration run list --workflow-uuid <claim-tool-workflow-uuid> --limit 1
cargo-ai orchestration run get <run-uuid>
```

4. When the claim reads `ready`, read every draft against the account's facts. A draft that states
   something the input did not hold is a prompt problem: fix the writer before anyone sends.
5. Note the run's credits: that is the per-claim cost to quote, at `contactsPerClaim`.

## Pilot send

1. On a draft, replace the recipient's address with one you own. The quickest way is a test
   contact: claim an account whose committee includes you, or edit the `contact_email` of one
   `cockpit_drafts` row with `cargo-ai storage record update`.
2. Send it. Read it in a real mail client: the From name, the paragraphs, the unsubscribe link.
3. Check the two writes:

```sh
cargo-ai storage query execute "SELECT status, message_uuid FROM object.cockpit_drafts WHERE contact_email = '<your address>'"
cargo-ai storage query execute "SELECT kind, subject, owner_email FROM object.gtm_activities ORDER BY occurred_at DESC LIMIT 1"
```

A refused send fails the run with its reason and marks nothing sent: `recipientSuppressed` (never
remove the suppression to get around it), `mailboxNotActive` (the mailbox is still provisioning or
was disabled), `dailyLimitReached` (the warm-up ramp; it lifts on its own).

## Pilot reply

The send marked the draft `sent`, and within fifteen minutes `rep_cockpit_watch_replies` starts a
run on it that waits on the thread:

```sh
cargo-ai orchestration play list
cargo-ai orchestration run list --workflow-uuid <watch-replies-workflow-uuid> --limit 1
```

1. Reply to the test email from the address you own. Within a few minutes of the reply the run
   ends: the card reads Replied with the reply's first lines, and the timeline lists it.
2. Click Meeting booked, and check the `meeting` row on `gtm_activities`.
3. To pilot the follow-up instead, do not reply. After `followUpAfterHours` the card reads
   Follow-up with a new draft; send it and check that it arrives in the same thread. Set
   `followUpAfterHours` to 1 on a pilot project to see it the same day, then set it back.

Run Regenerate once with an instruction, Find email and phone once on a person with no email, and
Add person once with a LinkedIn profile: each is one tool run (`rep_cockpit_redraft`,
`rep_cockpit_enrich_contact`, `rep_cockpit_add_contact`) and the cards change when it ends.

## After the pilot

Hand the URL to the reps. Read the pass reasons after the first week: many `no_fit` passes on
one tier means the tiering, not the reps, needs the change.

```sh
cargo-ai storage query execute "SELECT pass_reason, COUNT(*) AS passes FROM object.cockpit_claims WHERE status = 'passed' GROUP BY 1"
```

Watch the first week's claims for runs that end `failed`
(`cargo-ai orchestration run list` on the claim tool's workflow) and for accounts whose committee
search returned nobody: both usually mean the committee filters in `infra/settings.ts` are too
narrow for that market.
