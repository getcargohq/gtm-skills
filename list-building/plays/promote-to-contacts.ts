import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { waterfall } from "../connectors/waterfall";
import { contacts } from "../models/contacts";
import { salesNavLeads } from "../models/salesnav-leads";

// Merge extracted Sales Navigator people into the shared `contacts` model.
//
// A Sales Nav lead row has a name, a title, a company, and a LinkedIn profile
// URL, but NO email. `contacts` keys on `email`. So each row is resolved through
// the enrichment waterfall by LinkedIn URL, which is the highest-confidence key
// available here (far better than guessing from name plus company).
//
// Deduping is by LinkedIn profile in the source table and by email on the
// upsert. Both matter: the same person shows up in overlapping sub-searches, and
// the same person can hold two emails across jobs.
const promoteLead = defineWorkflow(
  "promote-salesnav-lead",
  {
    input: z.object({
      full_name: z.string(),
      first_name: z.any(),
      last_name: z.any(),
      job_title: z.any(),
      linkedin_profile_url: z.string(),
      current_company: z.any(),
    }),
    output: z.object({ promoted: z.boolean() }),
    uses: { waterfall },
  },
  ({ input, uses, model }) => {
    const person = uses.waterfall.enrichContact(
      { linkedin: input.linkedin_profile_url },
      { continueOnFailure: true },
    );

    // No email means the row cannot be keyed into `contacts`. Keep it in the
    // landing table (it is still a real person, and a later waterfall pass may
    // find them) but do not promote a contact we cannot address or dedupe.
    if (!person.person.professional_email) {
      return { promoted: false };
    }

    model.upsert({
      modelUuid: contacts.uuid as unknown as string,
      matchingColumnSlug: contacts.columns.email,
      matchingValue: person.person.professional_email,
      mappings: [
        {
          columnSlug: contacts.columns.email,
          value: person.person.professional_email,
        },
        { columnSlug: contacts.columns.name, value: input.full_name },
        { columnSlug: contacts.columns.first_name, value: input.first_name },
        { columnSlug: contacts.columns.last_name, value: input.last_name },
        { columnSlug: contacts.columns.title, value: input.job_title },
        {
          columnSlug: contacts.columns.linkedin_url,
          value: input.linkedin_profile_url,
        },
        { columnSlug: contacts.columns.lead_source, value: "sales-navigator" },
        {
          columnSlug: contacts.columns.custom__cargo_last_updated_at,
          value: new Date(),
        },
      ],
    });

    return { promoted: true };
  },
);

// COST: one credited enrichContact call per promoted person, and the 2,500 cap
// is per search, so a few sub-searches is thousands of calls. Under `watch` this
// fires once per extracted row, so promotion is 1:1 with extraction. The real
// control is upstream: the extraction cap in ../models/salesnav-leads.ts and how
// many sub-searches you add. Lower those to throttle; a play-level `limit` would
// do nothing under watch.
export const promoteToContacts = definePlay("promote-to-contacts", {
  model: salesNavLeads,
  workflow: promoteLead,
  changeKinds: ["added"],
  runCreationRule: "always",
  schedule: { type: "watch" },
});
