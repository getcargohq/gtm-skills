import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { replyClassifier } from "../agents/reply-classifier";
import { replyWriter } from "../agents/reply-writer";
import { slack } from "../connectors/slack";
import { playsFolder } from "../folders";
import { sender, senderName } from "../mailboxes/sender";
import { replyThreads } from "../models/reply-threads";
import { checkDraft } from "../scripts/reply/check-draft";
import { checkRow } from "../scripts/reply/check-row";
import { finalizeReply } from "../scripts/reply/finalize-reply";
import { proposeSlots } from "../scripts/reply/propose-slots";
import { routeReply } from "../scripts/reply/route-reply";
import { screenReply } from "../scripts/reply/screen-reply";
import {
  replyWaitHours,
  reviewChannelId,
  reviewTimeoutMilliseconds,
} from "../settings";

// One row in, one conversation out:
//
//   row guard      -> no fact or a bad address: blocked, nothing sent
//   first touch    -> written, gated, sent from the mailbox
//   wait           -> the run sleeps until they reply on that thread
//   hard stop      -> an opt-out is recorded and stopped before any model
//   classify       -> one of fifteen classes, routed by infra/settings.ts
//   draft          -> slots from the grid, an answer from the writer, gated
//   review         -> a person approves, edits or declines in Slack
//   send           -> the answer goes out in the same thread
//
// Every stage writes its result onto the row, so `reply_threads` is the state
// of every conversation.
const handleReply = defineWorkflow(
  "handle_reply",
  {
    input: z.object({
      email: z.string(),
      first_name: z.string(),
      last_name: z.string().optional(),
      company: z.string().optional(),
      title: z.string().optional(),
      fact: z.string().optional(),
    }),
    output: z.object({ status: z.string() }),
    uses: { replyClassifier, replyWriter, slack },
    imports: {
      replyThreads,
      sender,
      senderName,
      reviewChannelId,
      replyWaitHours,
      reviewTimeoutMilliseconds,
    },
  },
  ({
    input,
    uses,
    model,
    js,
    sendEmail,
    waitEmailEvent,
    listEmailEvents,
    humanReview,
  }) => {
    const row = checkRow({ email: input.email, fact: input.fact });

    if (row.ok !== true) {
      model.upsert({
        modelUuid: replyThreads.uuid,
        matchingColumnSlug: "email",
        matchingValue: input.email,
        mappings: [
          { columnSlug: "status", value: "first_touch_blocked" },
          { columnSlug: "gate_flags", value: row.reason },
          { columnSlug: "updated_at", value: new Date().toISOString() },
        ],
      });
      return { status: "first_touch_blocked" };
    }

    // 1. The first touch, from the row's fact. The play sends it rather than a
    //    sequencer because the wait below keys off this message: a thread the
    //    play did not start is a thread it can never hear back on.
    const touch = uses.replyWriter({
      prompt: `MODE: first_touch
sender_name: ${senderName}
first_name: ${input.first_name}
last_name: ${input.last_name}
title: ${input.title}
company: ${input.company}
fact: ${input.fact}
Return only the JSON object.`,
    });

    const firstTouch = checkDraft({
      subject: touch.answer.subject,
      bodyText: touch.answer.body_text,
      usedSlots: [],
      offeredSlots: [],
    });

    if (firstTouch.ok !== true) {
      model.upsert({
        modelUuid: replyThreads.uuid,
        matchingColumnSlug: "email",
        matchingValue: input.email,
        mappings: [
          { columnSlug: "status", value: "first_touch_blocked" },
          { columnSlug: "touch_subject", value: firstTouch.subject },
          { columnSlug: "touch_body", value: firstTouch.bodyText },
          { columnSlug: "gate_flags", value: firstTouch.flags },
          { columnSlug: "updated_at", value: new Date().toISOString() },
        ],
      });
      uses.slack.postMessage(
        {
          channelId: reviewChannelId,
          format: "markdown",
          disableUnfurling: true,
          body: `*First touch to ${input.first_name} ${input.last_name} (${input.email}) not sent*
*Gate:* ${firstTouch.flags}
Nothing went out. Fix the playbook or the row, then remove the row and add it back.`,
        },
        { continueOnFailure: true },
      );
      return { status: "first_touch_blocked" };
    }

    // 2. Send it. `mailboxUuid` is the declared mailbox, never computed, so the
    //    answer below goes out from the address the lead wrote back to.
    const sent = sendEmail({
      mailboxUuid: sender.uuid,
      to: input.email,
      subject: firstTouch.subject,
      bodyText: firstTouch.bodyText,
      bodyHtml: firstTouch.bodyHtml,
    });

    model.upsert({
      modelUuid: replyThreads.uuid,
      matchingColumnSlug: "email",
      matchingValue: input.email,
      mappings: [
        { columnSlug: "status", value: "waiting" },
        { columnSlug: "touch_subject", value: firstTouch.subject },
        { columnSlug: "touch_body", value: firstTouch.bodyText },
        { columnSlug: "touch_message_uuid", value: sent.messageUuid },
        { columnSlug: "touch_rfc_id", value: sent.rfcMessageId },
        { columnSlug: "sent_at", value: sent.sentAt },
        { columnSlug: "updated_at", value: new Date().toISOString() },
      ],
    });

    // 3. The run sleeps here until a reply lands on that thread, which is when
    //    Cargo's inbound sync for the mailbox picks it up. Silence ends the run
    //    at this node after `replyWaitHours`, with the row still `waiting`.
    const reply = waitEmailEvent({
      messageUuid: sent.messageUuid,
      kind: "replied",
      timeoutHours: replyWaitHours,
    });

    // The replied event carries the inbound Message-ID the answer threads under.
    const events = listEmailEvents({
      threadUuid: reply.threadUuid,
      kinds: ["replied"],
      limit: 3,
    });

    // 4. The hard stop, before any model reads a word of it.
    const screened = screenReply({ reply: reply, events: events });

    if (screened.hardStop === true) {
      model.upsert({
        modelUuid: replyThreads.uuid,
        matchingColumnSlug: "email",
        matchingValue: input.email,
        mappings: [
          { columnSlug: "status", value: "suppressed" },
          { columnSlug: "reply_class", value: "hard_stop" },
          { columnSlug: "routing", value: "suppress" },
          { columnSlug: "routing_reason", value: screened.hits },
          { columnSlug: "reply_snippet", value: screened.text },
          { columnSlug: "reply_from", value: screened.from },
          { columnSlug: "reply_at", value: screened.at },
          { columnSlug: "thread_uuid", value: screened.threadUuid },
          { columnSlug: "updated_at", value: new Date().toISOString() },
        ],
      });
      return { status: "suppressed" };
    }

    // 5. Classify, then route by the rules in infra/settings.ts.
    const verdict = uses.replyClassifier({
      prompt: `Classify this reply now. Follow Step 0 to Step 7 before answering.

<CURRENT_DATE_TIME>
${new Date().toISOString()}
</CURRENT_DATE_TIME>

<OUR_EMAIL>
Subject: ${firstTouch.subject}
${firstTouch.bodyText}
</OUR_EMAIL>

<REPLY>
From: ${screened.from}
Received: ${screened.at}
${screened.text}
</REPLY>`,
    });

    const route = routeReply({
      verdict: verdict.answer,
      replyText: screened.text,
      fallbackFirstName: input.first_name,
    });

    if (route.mode === "suppress") {
      model.upsert({
        modelUuid: replyThreads.uuid,
        matchingColumnSlug: "email",
        matchingValue: input.email,
        mappings: [
          { columnSlug: "status", value: "suppressed" },
          { columnSlug: "reply_class", value: route.replyClass },
          { columnSlug: "confidence", value: route.confidence },
          { columnSlug: "positivity", value: route.positivity },
          { columnSlug: "routing", value: route.mode },
          { columnSlug: "routing_reason", value: route.reason },
          { columnSlug: "reply_snippet", value: screened.text },
          { columnSlug: "reply_from", value: screened.from },
          { columnSlug: "reply_at", value: screened.at },
          { columnSlug: "thread_uuid", value: screened.threadUuid },
          { columnSlug: "updated_at", value: new Date().toISOString() },
        ],
      });
      return { status: "suppressed" };
    }

    // 6. Slots only when the classifier says proposing times is the next move
    //    (count 0 returns none), then the answer, then the gate.
    const slots = proposeSlots({
      guidance: route.guidance,
      count: route.slotCount,
    });

    const draft = uses.replyWriter({
      prompt: `MODE: reply
sender_name: ${senderName}
reply_class: ${route.replyClass}
tone_guidelines: ${route.tone}
reply_energy: ${route.energy}
contact_first_name: ${route.contactFirstName}
calendar_slot_guidelines: ${route.guidance}
calendar_slots: ${JSON.stringify(slots.slots)}
redirect_info: ${route.redirect}

<OUR_EMAIL>
Subject: ${firstTouch.subject}
${firstTouch.bodyText}
</OUR_EMAIL>

<THEIR_REPLY>
${screened.text}
</THEIR_REPLY>

Return only the JSON object.`,
    });

    const checked = checkDraft({
      subject: "",
      bodyText: draft.answer.body_text,
      usedSlots: draft.answer.used_slots,
      offeredSlots: slots.slots,
    });

    // 7. What came in and what is proposed, for whoever reviews it. The review
    //    card below carries only the draft, because what the reviewer edits
    //    there is what gets sent.
    uses.slack.postMessage(
      {
        channelId: reviewChannelId,
        format: "markdown",
        disableUnfurling: true,
        body: `*Reply from ${input.first_name} ${input.last_name} (${input.email})*
*Class:* ${route.replyClass}  *Confidence:* ${route.confidence}  *Positivity:* ${route.positivity}
*Routing:* ${route.mode}, ${route.reason}
*Why:* ${route.reasoning}
*Their reply:*
> ${screened.text}
*Slots offered:* ${slots.labels}
*Gate:* ${checked.flagSummary}`,
      },
      { continueOnFailure: true },
    );

    // 8. Reply Mode, only for a class switched to "reply" in settings.ts and
    //    only with a clean gate. Nothing ships this way by default.
    if (route.mode === "reply" && checked.ok === true) {
      const auto = sendEmail({
        mailboxUuid: sender.uuid,
        to: input.email,
        subject: `Re: ${firstTouch.subject}`,
        bodyText: checked.bodyText,
        bodyHtml: checked.bodyHtml,
        inReplyTo: screened.inboundMessageId,
        references: [sent.rfcMessageId, screened.inboundMessageId],
      });
      model.upsert({
        modelUuid: replyThreads.uuid,
        matchingColumnSlug: "email",
        matchingValue: input.email,
        mappings: [
          { columnSlug: "status", value: "auto_replied" },
          { columnSlug: "reply_class", value: route.replyClass },
          { columnSlug: "confidence", value: route.confidence },
          { columnSlug: "positivity", value: route.positivity },
          { columnSlug: "routing", value: route.mode },
          { columnSlug: "routing_reason", value: route.reason },
          { columnSlug: "slots", value: slots.labels },
          { columnSlug: "draft_body", value: checked.bodyText },
          { columnSlug: "gate_flags", value: checked.flags },
          { columnSlug: "review_decision", value: "auto" },
          { columnSlug: "final_body", value: checked.bodyText },
          { columnSlug: "reply_snippet", value: screened.text },
          { columnSlug: "reply_from", value: screened.from },
          { columnSlug: "reply_at", value: screened.at },
          { columnSlug: "reply_rfc_id", value: screened.inboundMessageId },
          { columnSlug: "thread_uuid", value: screened.threadUuid },
          { columnSlug: "reply_message_uuid", value: auto.messageUuid },
          { columnSlug: "replied_at", value: auto.sentAt },
          { columnSlug: "updated_at", value: new Date().toISOString() },
        ],
      });
      return { status: "auto_replied" };
    }

    model.upsert({
      modelUuid: replyThreads.uuid,
      matchingColumnSlug: "email",
      matchingValue: input.email,
      mappings: [
        { columnSlug: "status", value: "pending_review" },
        { columnSlug: "reply_class", value: route.replyClass },
        { columnSlug: "confidence", value: route.confidence },
        { columnSlug: "positivity", value: route.positivity },
        { columnSlug: "routing", value: route.mode },
        { columnSlug: "routing_reason", value: route.reason },
        { columnSlug: "slots", value: slots.labels },
        { columnSlug: "draft_body", value: checked.bodyText },
        { columnSlug: "gate_flags", value: checked.flags },
        { columnSlug: "reply_snippet", value: screened.text },
        { columnSlug: "reply_from", value: screened.from },
        { columnSlug: "reply_at", value: screened.at },
        { columnSlug: "reply_rfc_id", value: screened.inboundMessageId },
        { columnSlug: "thread_uuid", value: screened.threadUuid },
        { columnSlug: "updated_at", value: new Date().toISOString() },
      ],
    });

    // 9. Human Mode: Approve, Edit or Decline in Slack. The run holds here
    //    until someone clicks or the timeout declines it.
    humanReview({
      connectorUuid: slack.uuid,
      channelId: reviewChannelId,
      title: `Reply to ${input.first_name} ${input.last_name}? (${route.replyClass}, confidence ${route.confidence})`,
      content: checked.bodyText,
      timeoutMilliseconds: reviewTimeoutMilliseconds,
      enabledButtons: ["approve", "edit", "decline"],
    });

    // The decision is read from the node's own output, never from what the
    // call returns. Called without approved and declined bodies, `humanReview`
    // returns the literal `null`, so `if (review.approved)` reads
    // `null.approved` and every approval takes the declined path while the
    // node's output says `approved: true`. That cost three live approvals in
    // the build this comes from. The bodies would fix the return value, but
    // they merge into one end node through `??`, which this repo's authoring
    // guide lists as failing at run time. Reading the output is the version
    // that ran live.
    const review = js(({ nodes }) => {
      const output = nodes.humanReview || {};
      const user = output.user || {};
      let reviewedText = "";
      if (typeof output.content === "string") {
        reviewedText = output.content;
      }
      return {
        approved: output.approved === true,
        reviewedText: reviewedText,
        reviewer: String(user.name || user.username || ""),
      };
    });

    if (review.approved === true) {
      // The reviewer may have edited the body: what they approved is what goes.
      const final = finalizeReply({
        reviewedText: review.reviewedText,
        draftText: checked.bodyText,
      });

      // The click lands on the row before the send does. The send waits for
      // the mailbox's next slot, which on a young mailbox can be hours away,
      // and a row still reading pending_review in that window looks like the
      // approval was lost.
      model.upsert({
        modelUuid: replyThreads.uuid,
        matchingColumnSlug: "email",
        matchingValue: input.email,
        mappings: [
          { columnSlug: "status", value: "approved" },
          { columnSlug: "review_decision", value: final.decision },
          { columnSlug: "reviewer", value: review.reviewer },
          { columnSlug: "final_body", value: final.text },
          { columnSlug: "updated_at", value: new Date().toISOString() },
        ],
      });

      const answer = sendEmail({
        mailboxUuid: sender.uuid,
        to: input.email,
        subject: `Re: ${firstTouch.subject}`,
        bodyText: final.text,
        bodyHtml: final.html,
        inReplyTo: screened.inboundMessageId,
        references: [sent.rfcMessageId, screened.inboundMessageId],
      });

      model.upsert({
        modelUuid: replyThreads.uuid,
        matchingColumnSlug: "email",
        matchingValue: input.email,
        mappings: [
          { columnSlug: "status", value: "replied" },
          { columnSlug: "reply_message_uuid", value: answer.messageUuid },
          { columnSlug: "replied_at", value: answer.sentAt },
          { columnSlug: "updated_at", value: new Date().toISOString() },
        ],
      });
      return { status: "replied" };
    }

    // Decline and timeout both land here. Nothing is sent.
    model.upsert({
      modelUuid: replyThreads.uuid,
      matchingColumnSlug: "email",
      matchingValue: input.email,
      mappings: [
        { columnSlug: "status", value: "declined" },
        { columnSlug: "review_decision", value: "declined" },
        { columnSlug: "reviewer", value: review.reviewer },
        { columnSlug: "updated_at", value: new Date().toISOString() },
      ],
    });
    return { status: "declined" };
  },
);

// Runs once for every row ADDED to `reply_threads`, as it lands. An update to
// an existing row starts nothing, which is what stops a ledger write from
// re-running a conversation: to run someone through again, remove the row and
// add it back.
//
// Realtime works because `reply_threads` is a native model. `always` because
// each row is its own conversation, and a run can sleep for days at the wait
// and the review without blocking the next row.
//
// Ships disabled. Enabling it is the last yes of the pilot
// (references/run.md), and it is what makes adding a row send an email.
export const handleReplies = definePlay("handle_replies", {
  description:
    "Sends a first touch from the mailbox to each person added, waits for the reply, stops opt-outs before any model, classifies the rest, drafts the answer, asks a person in Slack, and sends the approved answer in the same thread.",
  folder: playsFolder,
  model: replyThreads,
  workflow: handleReply,
  isEnabled: false,
  runCreationRule: "always",
  changeKinds: ["added"],
  schedule: { type: "realtime" },
});
