# Running the loop

Every command runs from the project root after the deploy. Read the uuids from the deploy output or
`cargo.state.json`: the mailbox (`mailbox:sender`), the model (`model:reply_threads`) and the play
(`play:handle_replies`), plus the play's `workflowUuid` from `cargo-ai orchestration play list`.

## Warm

A mailbox takes minutes to provision, sometimes more than twenty. Poll until it reads `active`:

```sh
cargo-ai mailboxManagement mailbox refresh-status <mailbox-uuid>
```

Then start warm-up. Without it the mailbox stays at five real sends a day for good, and the days
of warm-up it does not get are not recovered later:

```sh
cargo-ai mailboxManagement mailbox start-warmup <mailbox-uuid> --daily-target 40
cargo-ai mailboxManagement mailbox get-send-allowance <mailbox-uuid>
```

Before the first send, check that MX, SPF and DKIM resolve for the sending domain. A mailbox whose
mail records are gone still reports `active`.

## Pilot on yourself

Nothing here sends to anyone but the operator. The play is still disabled at this point.

1. **Enable the play.** This is what makes adding a row send an email.

   ```sh
   cargo-ai orchestration play update <play-uuid> --is-enabled true
   ```

2. **Add one row, for the operator's own address.** The same native `modelUpsert` the play uses;
   a new email adds a row, and an added row starts a run.

   ```sh
   cargo-ai orchestration action execute \
     --action '{"kind":"native","actionSlug":"modelUpsert"}' \
     --data '{"modelUuid":"<model-uuid>","matchingColumnSlug":"email","matchingValue":"you@yourcompany.example","mappings":[{"columnSlug":"email","value":"you@yourcompany.example"},{"columnSlug":"first_name","value":"Pat"},{"columnSlug":"company","value":"Your company"},{"columnSlug":"title","value":"Your title"},{"columnSlug":"fact","value":"One true sentence about your company, as a lead would have it."}]}' \
     --wait-until-finished
   ```

3. **Watch the first touch go out.** The run writes the touch, gates it, sends it and parks at
   `waitEmailEvent`; the row reads `waiting`. A row that reads `first_touch_blocked` names the
   gate's flags in `gate_flags`: fix the playbook, remove the row, add it again.

   ```sh
   cargo-ai orchestration run list --workflow-uuid <workflow-uuid> --limit 5
   cargo-ai storage record list --model-uuid <model-uuid> --limit 20
   ```

   On a mailbox in its first days the send waits for the next slot: one every 1440 minutes divided
   by the day's ceiling, so up to 288 minutes at five a day. The run is not stuck.

4. **Reply from that inbox**, short and specific: "Sounds good. Thursday afternoon works, anything
   after 2pm." The run resumes when Cargo's inbound sync picks the reply up (`inboundSyncedAt` on
   `cargo-ai mailboxManagement mailbox get <mailbox-uuid>` shows the last one).

5. **Read the two Slack messages.** The context post (class, confidence, routing, the reply, the
   slots, the gate) and the review card with the draft. Check that the times offered match the
   reply. Click Edit, change one word, approve.

6. **Watch the answer land.** The row reads `approved` at once and `replied` when the send goes,
   which can be a slot later. In the operator's mail client the answer sits in the same thread as
   the first touch, under `Re:` and the original subject. `review_decision` reads `edited`.

7. **Test the hard stop.** Add a second row for the same inbox with plus-addressing
   (`you+optout@yourcompany.example`) and reply to its first touch with "Please remove me from this
   list." The row ends `suppressed`, `routing_reason` names the phrase, and the run trace shows no
   agent node after the wait:

   ```sh
   cargo-ai orchestration run get <run-uuid>
   ```

8. **Test a decline.** A third plus-address, any reply, Decline on the card. The row ends
   `declined` and nothing is sent.

To run someone through again, remove the row and add it back; an update to an existing row starts
nothing:

```sh
cargo-ai storage record remove --model-uuid <model-uuid> --id <record-id>
```

## Open

Only on an explicit yes after the pilot, and only for people the operator named. Add them the same
way as the pilot row, one `modelUpsert` per person.

- **Pace the adds to the ramp.** Each first touch waits for a send slot. Adding more people in a
  day than `get-send-allowance` returns does not fail; it queues first touches days out, and their
  replies arrive into a conversation that is already old.
- **Runs execute a few at a time.** In the build this comes from, about five ran at once, so a
  burst of a few hundred rows took most of an hour to work through before any mailbox limit
  applied. Enqueue fast and let Cargo drain it; nothing is lost.
- **Watch the ledger, not the inbox.** `pending_review` rows are cards waiting for a click; a row
  stuck at `waiting` past `replyWaitHours` ended its run at the wait, which is how silence ends.
