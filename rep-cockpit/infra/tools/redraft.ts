import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { firstTouchWriter } from "../agents/first-touch-writer";
import { toolsFolder } from "../folders";
import { cockpitDrafts } from "../models/cockpit-drafts";

// Regenerate: the rep says what is wrong with a draft ("shorter", "lead with
// the hire, not the round") and the writer rewrites it from the same input.
// Only the text changes, the LinkedIn note with it: the status, a follow-up
// included, stays as it was.
const redraftWorkflow = defineWorkflow(
  "redraft",
  {
    input: z.object({
      contact_id: z.string(),
      instruction: z.string(),
      rep_name: z.string(),
      account_name: z.string(),
      account_domain: z.string(),
      account_context: z.string().optional(),
      contact_name: z.string(),
      contact_title: z.string().optional(),
      linkedin_url: z.string().optional(),
      subject: z.string(),
      body: z.string(),
    }),
    output: z.object({ status: z.enum(["redrafted"]) }),
    uses: { firstTouchWriter },
    imports: { cockpitDrafts },
  },
  ({ input, uses, model }) => {
    const draft = uses.firstTouchWriter({
      prompt: `SENDER: ${input.rep_name}
ACCOUNT: ${input.account_name} (${input.account_domain})
ACCOUNT CONTEXT: ${input.account_context}
PERSON: ${input.contact_name}, ${input.contact_title}
LINKEDIN: ${input.linkedin_url}
CURRENT DRAFT:
Subject: ${input.subject}
${input.body}
REP INSTRUCTION: ${input.instruction}`,
    });

    model.upsert({
      modelUuid: cockpitDrafts.uuid,
      matchingColumnSlug: "contact_id",
      matchingValue: input.contact_id,
      mappings: [
        { columnSlug: "subject", value: draft.answer.subject },
        { columnSlug: "body", value: draft.answer.body },
        { columnSlug: "why_now", value: draft.answer.why_now },
        { columnSlug: "linkedin_note", value: draft.answer.linkedin_note },
        { columnSlug: "drafted_at", value: new Date() },
      ],
    });

    return { status: "redrafted" as const };
  },
);

export const redraft = defineTool("rep_cockpit_redraft", {
  name: "Cockpit · Redraft",
  description:
    "Rewrites one cockpit draft as the rep asks, with the first-touch writer, and saves it for review.",
  workflow: redraftWorkflow,
  folder: toolsFolder,
});
