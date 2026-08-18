import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { hubspot } from "../connectors/hubspot";
import { slack } from "../connectors/slack";
import { waterfall } from "../connectors/waterfall";
import { contacts } from "../models/contacts";
import { inboundCapacity } from "../capacities/inbound";
import { inboundTerritory } from "../territories/inbound";

// The inbound pipeline: verify → enrich → upsert to CRM → qualify → alert on
// hot. Exposed as a tool, so any form/webhook/agent can submit a lead — the
// tool's input schema is the form. All three connectors are adopted, credit-based examples;
// verification and enrichment run on Cargo credits (native waterfall).
const qualifyInbound = defineWorkflow(
  "qualify-inbound",
  {
    input: z.object({
      email: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      company: z.string(),
      message: z.string(),
    }),
    output: z.object({ tier: z.string(), synced: z.boolean() }),
    uses: { waterfall, hubspot, slack },
  },
  ({ input, uses, ai, allocate }) => {
    const verification = uses.waterfall.verifyEmail({ email: input.email });

    const person = uses.waterfall.enrichContact(
      {
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
      },
      { continueOnFailure: true },
    );

    uses.hubspot.upsertRecords({
      objectType: "contacts",
      matchingPropertyName: "email",
      matchingValue: input.email,
      mappings: [
        { propertyName: "firstname", value: input.firstName },
        { propertyName: "lastname", value: input.lastName },
        { propertyName: "company", value: input.company },
        { propertyName: "message", value: input.message },
        // Stamp the source so downstream (the inbound capacity's filter) can
        // isolate leads from this pipeline. PLACEHOLDER — this custom contact
        // property must exist in HubSpot; the capacity filters on the same slug.
        { propertyName: "lead_source", value: "inbound" },
      ],
    });

    // `ai(...)` is a value, not a node — the engine evaluates it wherever the
    // consuming field lands (a Slack body, an end variable). PLACEHOLDER —
    // state your ICP in the two prompts below.
    const tier = ai(
      `Qualify this inbound demo request against our ICP (B2B SaaS, 50-1000
employees, GTM or RevOps buyer).
Form: ${input.firstName} ${input.lastName} (${input.email}) at ${input.company} — "${input.message}".
Enrichment: ${person}.
Reply with exactly one word: "hot" or "standard".`,
    );

    // Branch on the verification node's output; deliverable emails alert the
    // team with an AI-drafted, signal-grounded summary.
    if (verification.email_status === "valid") {
      // Deliverable leads only: allocate to a member of the inbound rep pool,
      // capped by `inbound-capacity`. The record is keyed by email (the
      // contacts capacity `idColumnSlug`).
      const allocation = allocate({
        type: "territory",
        territoryUuid: inboundTerritory.uuid,
        capacityUuid: inboundCapacity.uuid,
        recordId: input.email,
      });

      // Stamp the allocated owner on the contact WITHOUT clobbering an existing
      // one (`skipIfExist`), so an inbound resubmission never steals a contact
      // from its current AE. `allocate`'s output is `{ member }`; PLACEHOLDER —
      // confirm the member field carrying the HubSpot owner id.
      uses.hubspot.updateRecords({
        objectType: "contacts",
        matchingPropertyName: "email",
        matchingValue: input.email,
        mappings: [
          {
            propertyName: "hubspot_owner_id",
            value: allocation.member.ids.hubspot,
            skipIfExist: true,
          },
        ],
      });

      uses.slack.postMessage({
        channelId: "C0000000000", // PLACEHOLDER — your inbound alerts channel
        format: "markdown",
        body: ai(
          `Write a one-line Slack alert for this inbound demo request. Start with
:fire: if the tier is "hot", otherwise :inbox_tray:.
Tier: ${tier}.
Form: ${input.firstName} ${input.lastName} (${input.email}) at ${input.company} — "${input.message}".
Enrichment: ${person}.`,
        ) as unknown as string,
      });
      return { tier, synced: true };
    }

    return { tier, synced: false };
  },
);

export const inboundIntake = defineTool("inbound-intake", {
  workflow: qualifyInbound,
  description:
    "Qualify an inbound demo request: verify the email, enrich, sync to CRM, and alert on hot leads.",
  emojiSlug: "inbox_tray",
});
