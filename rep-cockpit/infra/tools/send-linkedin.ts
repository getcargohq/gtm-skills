import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { linkedin } from "../connectors/linkedin";
import { toolsFolder } from "../folders";
import { cockpitDrafts } from "../models/cockpit-drafts";
import { gtmActivities } from "../models/gtm-activities";

// One LinkedIn touch, as the rep edited it, from the rep's own LinkedIn
// identity: an invite with the note to someone not yet connected, or a
// message to a connection. Then the same two writes as an email: the draft
// row marked, and a row on gtm_activities.
//
// GTM activities has no LinkedIn kind (meeting, call, email, note, task), so
// the touch is a `note` whose subject says LinkedIn. LinkedIn refuses an
// invite to someone already connected, and a message to someone who is not:
// the run fails with that reason and nothing is marked.
const sendLinkedinWorkflow = defineWorkflow(
  "send_linkedin",
  {
    input: z.object({
      contact_id: z.string(),
      account_id: z.string(),
      rep_email: z.string(),
      identity_id: z.string(),
      linkedin_url: z.string(),
      contact_name: z.string(),
      message: z.string(),
      // invite | message
      kind: z.enum(["invite", "message"]),
    }),
    output: z.object({ status: z.enum(["sent"]) }),
    uses: { linkedin },
    imports: { cockpitDrafts, gtmActivities },
  },
  ({ input, uses, model }) => {
    if (input.kind === "message") {
      uses.linkedin.messageProfile({
        linkedinProfileUrl: input.linkedin_url,
        message: input.message,
        identityIds: [input.identity_id],
      });
      model.upsert({
        modelUuid: cockpitDrafts.uuid,
        matchingColumnSlug: "contact_id",
        matchingValue: input.contact_id,
        mappings: [
          { columnSlug: "linkedin_note", value: input.message },
          { columnSlug: "linkedin_status", value: "messaged" },
          { columnSlug: "linkedin_sent_at", value: new Date() },
        ],
      });
    } else {
      uses.linkedin.connectProfile({
        linkedinProfileUrl: input.linkedin_url,
        message: input.message,
        identityIds: [input.identity_id],
      });
      model.upsert({
        modelUuid: cockpitDrafts.uuid,
        matchingColumnSlug: "contact_id",
        matchingValue: input.contact_id,
        mappings: [
          { columnSlug: "linkedin_note", value: input.message },
          { columnSlug: "linkedin_status", value: "invited" },
          { columnSlug: "linkedin_sent_at", value: new Date() },
        ],
      });
    }

    model.insert({
      modelUuid: gtmActivities.uuid,
      mappings: [
        { columnSlug: "account_id", value: input.account_id },
        { columnSlug: "contact_id", value: input.contact_id },
        { columnSlug: "occurred_at", value: new Date() },
        { columnSlug: "kind", value: "note" },
        {
          columnSlug: "subject",
          value: `LinkedIn ${input.kind} to ${input.contact_name}`,
        },
        { columnSlug: "body", value: input.message },
        { columnSlug: "owner_email", value: input.rep_email },
      ],
    });

    return { status: "sent" as const };
  },
);

export const sendLinkedin = defineTool("rep_cockpit_send_linkedin", {
  name: "Cockpit · Send on LinkedIn",
  description:
    "Sends one reviewed LinkedIn invite or message from the rep's own LinkedIn identity, marks the draft and logs the touch on GTM activities.",
  workflow: sendLinkedinWorkflow,
  folder: toolsFolder,
});
