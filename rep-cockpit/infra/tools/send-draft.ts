import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { toolsFolder } from "../folders";
import { cockpitDrafts } from "../models/cockpit-drafts";
import { gtmActivities } from "../models/gtm-activities";

// One send, as the rep edited it, from the rep's own mailbox, then the two
// writes that make it visible: the draft marked sent with its message ids, and
// an `email` row on gtm_activities that every other pipeline reads. Marking
// the draft sent is what starts the watch play on the thread.
//
// A tool rather than a native call from the browser, so the send and its log
// are one run: the activity row can never be lost because a tab closed after
// the send went out.
//
// A follow-up carries `in_reply_to`, the Message-ID of the email before it, so
// the mail client threads it under the first touch. The two branches differ
// only in that: a workflow cannot pass an absent value to `sendEmail`.
//
// `sendEmail` checks the workspace suppression list before anything leaves,
// paces per mailbox, and appends the unsubscribe link. A refused send
// (suppressed, mailbox not active, daily limit) fails this run with the
// reason, and the cockpit shows it: nothing is marked sent.
const sendDraftWorkflow = defineWorkflow(
  "send_draft",
  {
    input: z.object({
      contact_id: z.string(),
      account_id: z.string(),
      rep_email: z.string(),
      mailbox_uuid: z.string(),
      to: z.string(),
      subject: z.string(),
      body_text: z.string(),
      body_html: z.string(),
      // Emails sent to this person, this one included.
      touches: z.number(),
      in_reply_to: z.string().optional(),
    }),
    output: z.object({ status: z.enum(["sent"]) }),
    imports: { cockpitDrafts, gtmActivities },
  },
  ({ input, model, sendEmail }) => {
    if (input.in_reply_to) {
      const reply = sendEmail({
        mailboxUuid: input.mailbox_uuid,
        to: input.to,
        subject: input.subject,
        bodyText: input.body_text,
        bodyHtml: input.body_html,
        inReplyTo: input.in_reply_to,
        references: [input.in_reply_to],
      });

      model.upsert({
        modelUuid: cockpitDrafts.uuid,
        matchingColumnSlug: "contact_id",
        matchingValue: input.contact_id,
        mappings: [
          { columnSlug: "subject", value: input.subject },
          { columnSlug: "body", value: input.body_text },
          { columnSlug: "status", value: "sent" },
          { columnSlug: "sent_at", value: new Date() },
          { columnSlug: "touches", value: input.touches },
          { columnSlug: "message_uuid", value: reply.messageUuid },
          { columnSlug: "rfc_message_id", value: reply.rfcMessageId },
        ],
      });
    } else {
      const sent = sendEmail({
        mailboxUuid: input.mailbox_uuid,
        to: input.to,
        subject: input.subject,
        bodyText: input.body_text,
        bodyHtml: input.body_html,
      });

      model.upsert({
        modelUuid: cockpitDrafts.uuid,
        matchingColumnSlug: "contact_id",
        matchingValue: input.contact_id,
        mappings: [
          { columnSlug: "subject", value: input.subject },
          { columnSlug: "body", value: input.body_text },
          { columnSlug: "status", value: "sent" },
          { columnSlug: "sent_at", value: new Date() },
          { columnSlug: "touches", value: input.touches },
          { columnSlug: "message_uuid", value: sent.messageUuid },
          { columnSlug: "rfc_message_id", value: sent.rfcMessageId },
        ],
      });
    }

    model.insert({
      modelUuid: gtmActivities.uuid,
      mappings: [
        { columnSlug: "account_id", value: input.account_id },
        { columnSlug: "contact_id", value: input.contact_id },
        { columnSlug: "occurred_at", value: new Date() },
        { columnSlug: "kind", value: "email" },
        { columnSlug: "subject", value: input.subject },
        { columnSlug: "body", value: input.body_text },
        { columnSlug: "owner_email", value: input.rep_email },
      ],
    });

    return { status: "sent" as const };
  },
);

export const sendDraft = defineTool("rep_cockpit_send_draft", {
  name: "Cockpit · Send draft",
  description:
    "Sends one reviewed email from the rep's mailbox, a first touch or a follow-up in its thread, marks the draft sent and logs the email on GTM activities.",
  workflow: sendDraftWorkflow,
  folder: toolsFolder,
});
