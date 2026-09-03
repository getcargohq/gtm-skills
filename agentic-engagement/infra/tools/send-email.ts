import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { toolsFolder } from "../folders/agentic-engagement";
import { rep } from "../mailboxes/rep";

// The agent's only send path. An agent cannot call `sendEmail` directly, so
// this tool is not ceremony: it is the binding that pins every send to `rep`.
// The mailbox uuid is not a form field. If it were, the agent could pick a
// different inbox, and the native email trigger would wake the wrong chat.
const sendEmailFlow = defineWorkflow(
  "send_email",
  {
    input: z.object({
      to: z.string(),
      subject: z.string(),
      bodyHtml: z.string(),
      inReplyTo: z.string().optional(),
      references: z.array(z.string()).optional(),
    }),
    output: z.object({
      messageUuid: z.string().optional(),
      rfcMessageId: z.string().optional(),
    }),
    imports: { rep },
  },
  ({ input, sendEmail }) => {
    const sent = sendEmail({
      mailboxUuid: rep.uuid,
      to: input.to,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      inReplyTo: input.inReplyTo,
      references: input.references,
    });

    return {
      messageUuid: sent.messageUuid,
      rfcMessageId: sent.rfcMessageId,
    };
  },
);

export const sendEmailTool = defineTool("send-email", {
  folder: toolsFolder,
  workflow: sendEmailFlow,
  name: "Send email",
  description:
    "Send one email from the engager's mailbox. For a reply, pass inReplyTo and the full references chain, oldest first, so the thread stays together.",
  emojiSlug: "envelope",
});
