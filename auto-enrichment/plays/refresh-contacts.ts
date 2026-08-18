import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { hubspot } from "../connectors/hubspot";
import { waterfall } from "../connectors/waterfall";
import { contacts } from "../models/contacts";

// Per stale contact: run the credits-based waterfall (multi-provider fallback
// is built into the action — no BYO keys, no if/else chain) and write what it
// found back to the CRM.
const refreshContact = defineWorkflow(
  "refresh-contact",
  {
    input: z.object({
      email: z.string(),
      firstname: z.any(),
      lastname: z.any(),
      // PLACEHOLDER — the contact's LinkedIn profile URL column. `hs_linkedin_url`
      // is HubSpot's default; rename to your slug and make sure it's selected on
      // the contacts model.
      hs_linkedin_url: z.any(),
    }),
    output: z.object({ refreshed: z.boolean() }),
    uses: { waterfall, hubspot },
  },
  ({ input, uses }) => {
    // LinkedIn URL is the strong identity — name-only matching is ambiguous.
    // Names ride along as a fallback when the profile URL is missing.
    const enriched = uses.waterfall.enrichContact(
      {
        linkedin: input.hs_linkedin_url,
        first_name: input.firstname,
        last_name: input.lastname,
      },
      { continueOnFailure: true },
    );
    const phone = uses.waterfall.findPhone(
      { email: input.email },
      { continueOnFailure: true },
    );

    uses.hubspot.updateRecords({
      objectType: "contacts",
      matchingPropertyName: "email",
      matchingValue: input.email,
      mappings: [
        { propertyName: "jobtitle", value: enriched.person.title },
        { propertyName: "phone", value: phone.phone },
      ],
    });

    return { refreshed: true };
  },
);

// The freshness cron: contacts missing a job title re-enrich nightly.
// PLACEHOLDER — the staleness filter; add the columns your team relies on.
export const refreshContacts = definePlay("refresh-contacts", {
  model: contacts,
  workflow: refreshContact,
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
            operator: "isNotNull",
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: contacts.columns.title,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug: contacts.columns.phone,
            operator: "isNull",
          },
        ],
      },
    ],
  },
  schedule: { type: "cron", cron: "0 2 * * *" },
});
