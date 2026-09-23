import { definePlay, defineWorkflow, toolRef } from "@cargo-ai/cdk";
import { z } from "zod";

import { crm } from "../connectors/crm";
import { playsFolder } from "../folders/crm-enrichment";
import { crmContacts } from "../models/crm-contacts";
import { contactLinkedinEnrichment } from "../tools/contact-linkedin-enrichment";

// Instantiate Cargo's native Find Email tool, confirm that it accepts these
// inputs, and replace this value with its deployed tool UUID. Confirm the
// release output path before deployment; this example expects `email`.
const findEmail = toolRef<{ email?: string }>(
  "REPLACE-WITH-FIND-EMAIL-TOOL-UUID",
);

// Instantiate Cargo's native Find LinkedIn Profile from Email tool, confirm
// that it accepts email, and replace this value with its deployed tool UUID.
// This example expects the release output path `linkedin_url`.
const findLinkedinProfileFromEmail = toolRef<{ linkedin_url?: string }>(
  "REPLACE-WITH-FIND-LINKEDIN-PROFILE-FROM-EMAIL-TOOL-UUID",
);

const enrichCrmContact = defineWorkflow(
  "enrich_crm_contact",
  {
    input: z.object({
      hs_object_id: z.string(),
      firstname: z.string().optional(),
      lastname: z.string().optional(),
      email: z.string().optional(),
      linkedin_profile_url: z.string().optional(),
      linkedin_person_id: z.string().optional(),
      jobtitle: z.string().optional(),
    }),
    output: z.object({
      status: z.enum([
        "written",
        "skipped_no_identifier",
        "skipped_no_linkedin_profile",
      ]),
      email: z.string().optional(),
      person_id: z.string().optional(),
      job_title: z.string().optional(),
      linkedin_url: z.string().optional(),
    }),
    uses: {
      crm,
      findEmail,
      findLinkedinProfileFromEmail,
      contactLinkedinEnrichment,
    },
  },
  ({ input, uses }) => {
    if (input.linkedin_profile_url) {
      if (input.email) {
        // Both identifiers exist, so both native lookup tools are skipped.
        const result = uses.contactLinkedinEnrichment({
          linkedinUrl: input.linkedin_profile_url,
        });

        uses.crm.updateRecords({
          objectType: "contacts",
          matchingPropertyName: "hs_object_id",
          matchingValue: input.hs_object_id,
          mappings: [
            {
              propertyName: "email",
              value: input.email,
              skipIfExist: true,
            },
            {
              propertyName: "linkedin_person_id",
              value: result.person_id,
              skipIfExist: true,
            },
            {
              propertyName: "linkedin_profile_url",
              value: result.linkedin_url || input.linkedin_profile_url,
              skipIfExist: true,
            },
            {
              propertyName: "jobtitle",
              value: result.job_title,
              skipIfExist: true,
            },
            { propertyName: "cargo_last_enriched_at", value: new Date() },
            { propertyName: "cargo_enrichment_status", value: "succeeded" },
          ],
        });

        return {
          status: "written" as const,
          email: input.email,
          person_id: result.person_id,
          job_title: result.job_title,
          linkedin_url: result.linkedin_url || input.linkedin_profile_url,
        };
      }

      // LinkedIn exists but email is blank. Resolve the missing email, then
      // enrich the known profile whether or not an email is found.
      const foundEmail = uses.findEmail({
        linkedin_url: input.linkedin_profile_url,
        first_name: input.firstname,
        last_name: input.lastname,
      });
      const result = uses.contactLinkedinEnrichment({
        linkedinUrl: input.linkedin_profile_url,
      });

      uses.crm.updateRecords({
        objectType: "contacts",
        matchingPropertyName: "hs_object_id",
        matchingValue: input.hs_object_id,
        mappings: [
          {
            propertyName: "email",
            value: foundEmail.email,
            skipIfExist: true,
          },
          {
            propertyName: "linkedin_person_id",
            value: result.person_id,
            skipIfExist: true,
          },
          {
            propertyName: "linkedin_profile_url",
            value: result.linkedin_url || input.linkedin_profile_url,
            skipIfExist: true,
          },
          {
            propertyName: "jobtitle",
            value: result.job_title,
            skipIfExist: true,
          },
          { propertyName: "cargo_last_enriched_at", value: new Date() },
          { propertyName: "cargo_enrichment_status", value: "succeeded" },
        ],
      });

      return {
        status: "written" as const,
        email: foundEmail.email,
        person_id: result.person_id,
        job_title: result.job_title,
        linkedin_url: result.linkedin_url || input.linkedin_profile_url,
      };
    }

    if (input.email) {
      // Email exists but LinkedIn is blank. Stop on a resolver miss, and call
      // custom enrichment only after a profile URL is available.
      const foundLinkedin = uses.findLinkedinProfileFromEmail({
        email: input.email,
      });

      if (!foundLinkedin.linkedin_url) {
        return {
          status: "skipped_no_linkedin_profile" as const,
          email: input.email,
        };
      }

      const result = uses.contactLinkedinEnrichment({
        linkedinUrl: foundLinkedin.linkedin_url,
      });

      uses.crm.updateRecords({
        objectType: "contacts",
        matchingPropertyName: "hs_object_id",
        matchingValue: input.hs_object_id,
        mappings: [
          {
            propertyName: "email",
            value: input.email,
            skipIfExist: true,
          },
          {
            propertyName: "linkedin_person_id",
            value: result.person_id,
            skipIfExist: true,
          },
          {
            propertyName: "linkedin_profile_url",
            value: result.linkedin_url || foundLinkedin.linkedin_url,
            skipIfExist: true,
          },
          {
            propertyName: "jobtitle",
            value: result.job_title,
            skipIfExist: true,
          },
          { propertyName: "cargo_last_enriched_at", value: new Date() },
          { propertyName: "cargo_enrichment_status", value: "succeeded" },
        ],
      });

      return {
        status: "written" as const,
        email: input.email,
        person_id: result.person_id,
        job_title: result.job_title,
        linkedin_url: result.linkedin_url || foundLinkedin.linkedin_url,
      };
    }

    return { status: "skipped_no_identifier" as const };
  },
);

// Blank HubSpot strings surface as either NULL or empty in the Cargo extract.
// Every string blank test below pairs isNull with isEmpty.
export const enrichContacts = definePlay("enrich_contacts", {
  folder: playsFolder,
  model: crmContacts,
  workflow: enrichCrmContact,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_profile_url,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.email,
            operator: "isNotEmpty",
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "date",
            columnSlug: crmContacts.columns.cargo_last_enriched_at,
            operator: "isNull",
          },
          {
            kind: "date",
            columnSlug: crmContacts.columns.cargo_last_enriched_at,
            operator: "lowerThan",
            value: "6 months",
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmContacts.columns.email,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.email,
            operator: "isEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_person_id,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_person_id,
            operator: "isEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_profile_url,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_profile_url,
            operator: "isEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.jobtitle,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.jobtitle,
            operator: "isEmpty",
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "0 7 * * *" },
});
