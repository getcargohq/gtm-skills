import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { hubspot } from "../connectors/hubspot";
import { slack } from "../connectors/slack";
import { contacts } from "../models/contacts";
import { accountBrief } from "../tools/brief";
import { copywriter } from "../agents/copywriter";
import { emailBison } from "../connectors/email-bison";

// Per net-new contact: research the account (the research-agent skill's
// tool), draft a personalized first touch (the copywriter agent), stamp it on
// the CRM record, then enrol the contact in an Email Bison campaign that sends
// the AI body — and post the send to the ops channel with a link to the lead.
const sendForContact = defineWorkflow(
  "send-outreach",
  {
    input: z.object({
      email: z.string(),
      company: z.any(),
      firstname: z.any(),
      lastname: z.any(),
    }),
    output: z.object({ enrolled: z.boolean() }),
    uses: { accountBrief, copywriter, hubspot, slack, emailBison },
  },
  ({ input, uses }) => {
    // PLACEHOLDER: your Email Bison instance URL (match the connector's
    // `domain`). Declared inside the body: a workflow body is parsed, not run,
    // so it cannot read module-scope constants.
    const bisonAppUrl = "https://send.example.com";

    const research = uses.accountBrief({ domain: input.company });

    const draft = uses.copywriter({
      prompt: `Write the first-touch email for ${input.email}.
Research brief:\n${research.brief}`,
    }).answer;

    uses.hubspot.updateRecords({
      objectType: "contacts",
      matchingPropertyName: "email",
      matchingValue: input.email,
      mappings: [{ propertyName: "outreach_draft", value: draft }],
    });

    // Push the contact into Email Bison and attach it to the campaign. The draft
    // rides along as the `outreach_draft` custom variable so the campaign's email
    // step can reference it as `{{outreach_draft}}` — the AI body becomes the
    // send. `upsertLead` dedupes on email; its lead id feeds the campaign import.
    const lead = uses.emailBison.upsertLead({
      email: input.email,
      firstName: input.firstname,
      lastName: input.lastname,
      company: input.company,
      customVariables: [{ name: "outreach_draft", value: draft }],
    });

    uses.emailBison.importLeadToCampaign({
      campaignId: "PLACEHOLDER", // your Email Bison campaign id (autocompletes in the UI)
      leadId: lead.id,
    });

    uses.slack.postMessage({
      channelId: "C0000000000", // PLACEHOLDER — your outreach ops channel
      format: "markdown",
      body: `:rocket: *${input.email}* enrolled in Email Bison campaign: <${bisonAppUrl}/leads/${lead.id}|view lead>\n>${draft}`,
    });

    return { enrolled: true };
  },
);

// Fires for every net-new contact with an email — in practice, everything the
// contact-sourcing skill writes. PLACEHOLDER — tighten the filter to your
// outreach-eligible slice (tier, persona, signal recency).
export const sendOutreach = definePlay("send-outreach", {
  model: contacts,
  workflow: sendForContact,
  changeKinds: ["added"],
  runCreationRule: "always",
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: contacts.columns.email,
            operator: "isNotEmpty",
          },
        ],
      },
    ],
  },
  schedule: { type: "realtime" },
});
