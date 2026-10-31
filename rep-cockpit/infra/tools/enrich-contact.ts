import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { prospeo } from "../connectors/prospeo";
import { toolsFolder } from "../folders";
import { cockpitDrafts } from "../models/cockpit-drafts";
import { gtmContacts } from "../models/gtm-contacts";

// Find email and phone for one person, on a rep's click: the email by name
// and domain (the claim's lookup, again), the mobile by LinkedIn profile. The
// claim never looks up a phone, because most first touches are email and a
// phone costs several times an email: the rep pays for it when they will call.
//
// Each miss is a normal answer: the run goes on and writes what it found. The
// cockpit sends to `contact_email` whatever the status says, so a found email
// makes a no_email draft sendable with no status write here.
const enrichContactWorkflow = defineWorkflow(
  "enrich_contact",
  {
    input: z.object({
      contact_id: z.string(),
      contact_name: z.string(),
      account_domain: z.string(),
      linkedin_url: z.string(),
    }),
    output: z.object({ status: z.enum(["enriched"]) }),
    uses: { prospeo },
    imports: { cockpitDrafts, gtmContacts },
  },
  ({ input, uses, model }) => {
    const found = uses.prospeo.findEmail(
      { fullName: input.contact_name, companyDomain: input.account_domain },
      { continueOnFailure: true },
    );

    if (found.person.email.email) {
      model.upsert({
        modelUuid: gtmContacts.uuid,
        matchingColumnSlug: "linkedin_url",
        matchingValue: input.linkedin_url,
        mappings: [{ columnSlug: "email", value: found.person.email.email }],
      });
      model.upsert({
        modelUuid: cockpitDrafts.uuid,
        matchingColumnSlug: "contact_id",
        matchingValue: input.contact_id,
        mappings: [
          { columnSlug: "contact_email", value: found.person.email.email },
        ],
      });
    }

    const phone = uses.prospeo.findPhone(
      { url: input.linkedin_url },
      { continueOnFailure: true },
    );

    if (phone.person.mobile.mobile) {
      model.upsert({
        modelUuid: gtmContacts.uuid,
        matchingColumnSlug: "linkedin_url",
        matchingValue: input.linkedin_url,
        mappings: [
          { columnSlug: "mobile_phone", value: phone.person.mobile.mobile },
        ],
      });
      model.upsert({
        modelUuid: cockpitDrafts.uuid,
        matchingColumnSlug: "contact_id",
        matchingValue: input.contact_id,
        mappings: [
          { columnSlug: "contact_phone", value: phone.person.mobile.mobile },
        ],
      });
    }

    return { status: "enriched" as const };
  },
);

export const enrichContact = defineTool("rep_cockpit_enrich_contact", {
  name: "Cockpit · Find email and phone",
  description:
    "Looks up one sourced person's work email and mobile with Prospeo and saves what it finds on the contact and the cockpit draft.",
  workflow: enrichContactWorkflow,
  folder: toolsFolder,
});
