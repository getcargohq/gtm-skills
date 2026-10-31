import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { firstTouchWriter } from "../agents/first-touch-writer";
import { playsFolder } from "../folders";
import { cockpitDrafts } from "../models/cockpit-drafts";
import { gtmActivities } from "../models/gtm-activities";
import { followUpAfterHours, touchesPerContact } from "../settings";

// One run per sent email: wait on its thread for a reply, then either log the
// reply or draft the next touch. It never sends. A follow-up lands on the
// draft row as `follow_up` and waits for the rep like any other draft; the
// rep's Send marks the row `sent` again, and that starts the next watch.
//
//   replied       draft row replied, with the snippet; an `email` activity
//   no reply      under `touchesPerContact`: the writer drafts the follow-up
//                 at it: the row is marked no_reply
//
// `waitEmailEvent` fails when the wait runs out; `continueOnFailure` turns
// that into the no-reply branch, with `matched` empty.
const watchReply = defineWorkflow(
  "watch_reply",
  {
    input: z.object({
      contact_id: z.string(),
      account_id: z.string(),
      account_name: z.string(),
      account_domain: z.string(),
      rep_email: z.string(),
      rep_name: z.string(),
      contact_name: z.string(),
      contact_title: z.string().optional(),
      linkedin_url: z.string().optional(),
      subject: z.string(),
      body: z.string(),
      message_uuid: z.string(),
      touches: z.number(),
    }),
    output: z.object({ status: z.enum(["watched"]) }),
    uses: { firstTouchWriter },
    imports: {
      cockpitDrafts,
      gtmActivities,
      followUpAfterHours,
      touchesPerContact,
    },
  },
  ({ input, uses, model, waitEmailEvent }) => {
    const reply = waitEmailEvent(
      {
        messageUuid: input.message_uuid,
        kind: "replied",
        timeoutHours: followUpAfterHours,
      },
      { continueOnFailure: true },
    );

    if (reply.matched) {
      model.upsert({
        modelUuid: cockpitDrafts.uuid,
        matchingColumnSlug: "contact_id",
        matchingValue: input.contact_id,
        mappings: [
          { columnSlug: "status", value: "replied" },
          { columnSlug: "reply_snippet", value: reply.snippet },
          { columnSlug: "replied_at", value: reply.occurredAt },
        ],
      });
      model.insert({
        modelUuid: gtmActivities.uuid,
        mappings: [
          { columnSlug: "account_id", value: input.account_id },
          { columnSlug: "contact_id", value: input.contact_id },
          { columnSlug: "occurred_at", value: reply.occurredAt },
          { columnSlug: "kind", value: "email" },
          { columnSlug: "subject", value: `Reply from ${input.contact_name}` },
          { columnSlug: "body", value: reply.snippet },
          { columnSlug: "owner_email", value: input.rep_email },
        ],
      });
    } else {
      if (input.touches < touchesPerContact) {
        const next = uses.firstTouchWriter({
          prompt: `SENDER: ${input.rep_name}
ACCOUNT: ${input.account_name} (${input.account_domain})
PERSON: ${input.contact_name}, ${input.contact_title}
LINKEDIN: ${input.linkedin_url}
PREVIOUS EMAIL (no reply):
Subject: ${input.subject}
${input.body}`,
        });
        model.upsert({
          modelUuid: cockpitDrafts.uuid,
          matchingColumnSlug: "contact_id",
          matchingValue: input.contact_id,
          mappings: [
            { columnSlug: "body", value: next.answer.body },
            { columnSlug: "why_now", value: next.answer.why_now },
            { columnSlug: "status", value: "follow_up" },
            { columnSlug: "drafted_at", value: new Date() },
          ],
        });
      } else {
        model.upsert({
          modelUuid: cockpitDrafts.uuid,
          matchingColumnSlug: "contact_id",
          matchingValue: input.contact_id,
          mappings: [{ columnSlug: "status", value: "no_reply" }],
        });
      }
    }

    return { status: "watched" as const };
  },
);

// Every draft that becomes `sent`. `changeKinds: ["added"]` starts one watch
// per send: a row that leaves `sent` (follow_up, replied) and comes back with
// the next send is added again. Runs are concurrent by default, which a wait
// of days needs.
//
// Enabled on deploy: it is the reply half of the loop, and it never sends.
// Its cost is at most one writer call per sent email.
export const watchReplies = definePlay("rep_cockpit_watch_replies", {
  description:
    "Waits on each email sent from the cockpit for a reply: logs the reply on the account, or drafts the follow-up for the rep to send.",
  folder: playsFolder,
  model: cockpitDrafts,
  workflow: watchReply,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: cockpitDrafts.columns.status,
            operator: "is",
            values: ["sent"],
          },
        ],
      },
    ],
  },
  isEnabled: true,
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "*/15 * * * *" },
});
