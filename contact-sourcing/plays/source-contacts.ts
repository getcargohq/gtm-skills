import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { cargoDb } from "../connectors/cargo";
import { hubspot } from "../connectors/hubspot";
import { waterfall } from "../connectors/waterfall";
import { accounts } from "../models/accounts";

// Per account: match the domain against Cargo's business database, pull
// persona-matching prospects, waterfall-enrich each for an email, verify it,
// and write the valid ones to the CRM. Everything runs on Cargo credits — no
// provider keys. The `for...of` lowers to a real per-item loop node;
// `upsertRecords` matching on email is the dedupe.
const sourceForAccount = defineWorkflow(
  "source-contacts",
  {
    input: z.object({ domain: z.string() }),
    output: z.object({ sourced: z.boolean() }),
    uses: { cargoDb, waterfall, hubspot },
  },
  ({ input, uses }) => {
    const business = uses.cargoDb.matchBusiness({ domain: input.domain });

    // PLACEHOLDER — your persona filters (levels, titles, departments).
    const people = uses.cargoDb.fetchProspects({
      business_id: business.business_id,
      job_level: ["VP", "Director", "Head"],
      job_department: ["Sales", "Marketing"],
      limit: 25, // PLACEHOLDER — prospects to pull per account
    });

    for (const person of people) {
      const contact = uses.waterfall.enrichContact(
        { linkedin: person.linkedin_url, domain: input.domain },
        { continueOnFailure: true },
      );
      const verification = uses.waterfall.verifyEmail(
        { email: contact.person.professional_email },
        { continueOnFailure: true },
      );

      if (verification.email_status === "valid") {
        uses.hubspot.upsertRecords({
          objectType: "contacts",
          matchingPropertyName: "email",
          matchingValue: contact.person.professional_email,
          mappings: [
            { propertyName: "firstname", value: person.first_name },
            { propertyName: "lastname", value: person.last_name },
            { propertyName: "jobtitle", value: person.job_title },
            { propertyName: "company", value: input.domain },
          ],
        });
      }
    }

    return { sourced: true };
  },
);

// Runs for every account that enters the SAM. PLACEHOLDER — the filter is
// your SAM definition; it ships as "has a domain" so it runs on any account.
export const sourceContacts = definePlay("source-contacts", {
  model: accounts,
  workflow: sourceForAccount,
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
            columnSlug: accounts.columns.website,
            operator: "isNotEmpty",
          },
        ],
      },
    ],
  },
  schedule: { type: "realtime" },
});
