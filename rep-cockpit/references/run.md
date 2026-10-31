# Running the cockpit

The pilot is one claim and one send to an address you own. Nothing goes to a prospect until both
have been read by a person.

## Queue

The Hot leads query is `infra/apps/cockpit/src/lib/queries.ts` (`hotLeadsQuery`). It reads three
tables:

| Table                   | Owned by          | Columns read                                                   |
| ----------------------- | ----------------- | -------------------------------------------------------------- |
| `object.accounts`       | readiness-scoring | `domain`, `metric__readiness_score`, `computed__readiness_stage` |
| `ai_ark.tam_companies`  | account-scoring   | `domain`, `name`, `custom__tier`, `custom__tier_reason`        |
| `object.cockpit_claims` | this skill        | `account_domain`, `status`                                     |

`object` is the workspace's native dataset; `ai_ark` is the dataset of the connector tam-building
sources through. Confirm both, and the columns:

```sh
cargo-ai storage dataset list
cargo-ai storage column list --model-uuid <unify-accounts-uuid>
cargo-ai storage column list --model-uuid <tam-companies-uuid>
```

Then run the query by hand, with `cockpit_claims` removed from it if the model is not deployed
yet, and read the rows:

```sh
cargo-ai storage query execute "<hotLeadsQuery>"
```

An empty result here is an empty Hot leads page in the app, not an error. The usual causes: no
account is `ready_now` or `warming` yet (readiness-scoring's thresholds), the tiered model's
domains carry a scheme or `www.` and match nothing, or the dataset slug differs.

## Pilot claim

1. Open the app (`cargo-ai hosting app list` gives the URL) and sign in as a rep listed in
   `infra/members/reps.ts`.
2. Claim one account from Hot leads. The page moves to the account and says it is sourcing.
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

## After the pilot

Hand the URL to the reps. Watch the first week's claims for runs that end `failed`
(`cargo-ai orchestration run list` on the claim tool's workflow) and for accounts whose committee
search returned nobody: both usually mean the committee filters in `infra/settings.ts` are too
narrow for that market.
