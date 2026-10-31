import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { firstTouchWriter } from "../agents/first-touch-writer";
import { toolsFolder } from "../folders";
import { cockpitDrafts } from "../models/cockpit-drafts";
import { gtmContacts } from "../models/gtm-contacts";

// A person the committee search missed: a champion the rep already knows, a
// name from a call. The rep gives the LinkedIn profile and what they know; the
// writer drafts a first touch like any claimed person's. No lookup runs here:
// without an email the card offers "Find email and phone", so a paid lookup is
// always the rep's click.
const addContactWorkflow = defineWorkflow(
  "add_contact",
  {
    input: z.object({
      account_domain: z.string(),
      account_name: z.string(),
      account_id: z.string(),
      account_context: z.string().optional(),
      rep_email: z.string(),
      rep_name: z.string(),
      contact_name: z.string(),
      contact_title: z.string().optional(),
      contact_email: z.string().optional(),
      linkedin_url: z.string(),
    }),
    output: z.object({ status: z.enum(["added"]) }),
    uses: { firstTouchWriter },
    imports: { gtmContacts, cockpitDrafts },
  },
  ({ input, uses, model }) => {
    const contacts = model.upsert<{ id: string }>({
      modelUuid: gtmContacts.uuid,
      matchingColumnSlug: "linkedin_url",
      matchingValue: input.linkedin_url,
      mappings: [
        { columnSlug: "linkedin_url", value: input.linkedin_url },
        { columnSlug: "account_id", value: input.account_id },
        { columnSlug: "name", value: input.contact_name },
        { columnSlug: "title", value: input.contact_title },
        { columnSlug: "email", value: input.contact_email },
        { columnSlug: "lead_source", value: "rep_cockpit" },
      ],
    });

    const draft = uses.firstTouchWriter({
      prompt: `SENDER: ${input.rep_name}
ACCOUNT: ${input.account_name} (${input.account_domain})
ACCOUNT CONTEXT: ${input.account_context}
PERSON: ${input.contact_name}, ${input.contact_title}
LINKEDIN: ${input.linkedin_url}`,
    });

    if (input.contact_email) {
      model.upsert({
        modelUuid: cockpitDrafts.uuid,
        matchingColumnSlug: "contact_id",
        matchingValue: contacts[0].id,
        mappings: [
          { columnSlug: "contact_id", value: contacts[0].id },
          { columnSlug: "account_domain", value: input.account_domain },
          { columnSlug: "account_id", value: input.account_id },
          { columnSlug: "account_name", value: input.account_name },
          { columnSlug: "rep_email", value: input.rep_email },
          { columnSlug: "rep_name", value: input.rep_name },
          { columnSlug: "contact_name", value: input.contact_name },
          { columnSlug: "contact_title", value: input.contact_title },
          { columnSlug: "contact_email", value: input.contact_email },
          { columnSlug: "linkedin_url", value: input.linkedin_url },
          { columnSlug: "subject", value: draft.answer.subject },
          { columnSlug: "body", value: draft.answer.body },
          { columnSlug: "why_now", value: draft.answer.why_now },
          { columnSlug: "linkedin_note", value: draft.answer.linkedin_note },
          { columnSlug: "status", value: "draft" },
          { columnSlug: "touches", value: 0 },
          { columnSlug: "drafted_at", value: new Date() },
        ],
      });
    } else {
      model.upsert({
        modelUuid: cockpitDrafts.uuid,
        matchingColumnSlug: "contact_id",
        matchingValue: contacts[0].id,
        mappings: [
          { columnSlug: "contact_id", value: contacts[0].id },
          { columnSlug: "account_domain", value: input.account_domain },
          { columnSlug: "account_id", value: input.account_id },
          { columnSlug: "account_name", value: input.account_name },
          { columnSlug: "rep_email", value: input.rep_email },
          { columnSlug: "rep_name", value: input.rep_name },
          { columnSlug: "contact_name", value: input.contact_name },
          { columnSlug: "contact_title", value: input.contact_title },
          { columnSlug: "linkedin_url", value: input.linkedin_url },
          { columnSlug: "subject", value: draft.answer.subject },
          { columnSlug: "body", value: draft.answer.body },
          { columnSlug: "why_now", value: draft.answer.why_now },
          { columnSlug: "linkedin_note", value: draft.answer.linkedin_note },
          { columnSlug: "status", value: "no_email" },
          { columnSlug: "touches", value: 0 },
          { columnSlug: "drafted_at", value: new Date() },
        ],
      });
    }

    return { status: "added" as const };
  },
);

export const addContact = defineTool("rep_cockpit_add_contact", {
  name: "Cockpit · Add contact",
  description:
    "Adds a person a rep names to a claimed account and drafts a first touch for them, for review in the cockpit.",
  workflow: addContactWorkflow,
  folder: toolsFolder,
});
