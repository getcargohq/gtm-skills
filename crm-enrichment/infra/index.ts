import {
  defineConnector,
  defineModel,
  definePlay,
  defineTool,
  defineWorkflow,
  toolRef,
} from "@cargo-ai/cdk";
import { z } from "zod";

// Checked HubSpot example. For Salesforce or Attio, replace the connector
// integration, the account and contact extractors, the record-id field, the
// write action, and the fill-blank guard. Keep one CRM shape in this file.
const crm = defineConnector("crm", {
  integration: "hubspot",
  adopt: true,
});

export const crmAccounts = defineModel("crm_accounts", {
  connector: crm,
  extractSlug: "fetchRecords",
  config: { objectType: "companies", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 * * * *" },
});

const linkedin = defineConnector("linkedin", {
  integration: "linkedin",
  adopt: true,
});

const enrichCompanyData = defineWorkflow(
  "account_enrichment_workflow",
  {
    input: z.object({
      linkedinUrlOrHandle: z.string().optional(),
      domain: z.string().optional(),
    }),
    output: z.object({
      company_id: z.string().optional(),
      company_name: z.string().optional(),
      domain: z.string().optional(),
      website: z.string().optional(),
      linkedin_url: z.string().optional(),
      employee_count: z.number().optional(),
    }),
    uses: { linkedin },
  },
  ({ input, uses }) => {
    if (!input.linkedinUrlOrHandle && !input.domain) {
      return {};
    }

    if (input.linkedinUrlOrHandle) {
      const result = uses.linkedin.enrichCompany({
        linkedinUrl: input.linkedinUrlOrHandle.startsWith("http")
          ? input.linkedinUrlOrHandle
          : `https://www.linkedin.com/company/${input.linkedinUrlOrHandle}`,
      });

      return {
        company_id: result.company_id,
        company_name: result.company_name,
        domain: result.domain,
        website: result.website,
        linkedin_url: result.linkedin_url,
        employee_count: result.employee_count,
      };
    }

    const result = uses.linkedin.enrichCompanyFromDomain({
      domain: input.domain,
    });

    return {
      company_id: result.company_id,
      company_name: result.company_name,
      domain: result.domain,
      website: result.website,
      linkedin_url: result.linkedin_url,
      employee_count: result.employee_count,
    };
  },
);

export const accountEnrichment = defineTool("account_enrichment", {
  workflow: enrichCompanyData,
  name: "Account enrichment",
  description:
    "Normalize a company identifier and return enriched company data without writing to a CRM.",
});

const enrichCrmAccount = defineWorkflow(
  "enrich_crm_account",
  {
    input: z.object({
      hs_object_id: z.string(),
      linkedin_company_id: z.string().optional(),
      name: z.string().optional(),
      domain: z.string().optional(),
      website: z.string().optional(),
      linkedin_company_page: z.string().optional(),
      numberofemployees: z.number().optional(),
    }),
    output: z.object({
      status: z.literal("written"),
      company_id: z.string().optional(),
      company_name: z.string().optional(),
      domain: z.string().optional(),
      website: z.string().optional(),
      linkedin_url: z.string().optional(),
      employee_count: z.number().optional(),
    }),
    uses: { crm, accountEnrichment },
  },
  ({ input, uses }) => {
    const result = uses.accountEnrichment({
      linkedinUrlOrHandle: input.linkedin_company_page,
      domain: input.domain,
    });

    uses.crm.updateRecords({
      objectType: "companies",
      matchingPropertyName: "hs_object_id",
      matchingValue: input.hs_object_id,
      mappings: [
        {
          propertyName: "linkedin_company_id",
          value: result.company_id,
          skipIfExist: true,
        },
        {
          propertyName: "name",
          value: result.company_name,
          skipIfExist: true,
        },
        {
          propertyName: "domain",
          value: result.domain,
          skipIfExist: true,
        },
        {
          propertyName: "website",
          value: result.website,
          skipIfExist: true,
        },
        {
          propertyName: "linkedin_company_page",
          value: result.linkedin_url,
          skipIfExist: true,
        },
        {
          propertyName: "numberofemployees",
          value: result.employee_count,
          skipIfExist: true,
        },
        { propertyName: "cargo_last_enriched_at", value: new Date() },
        { propertyName: "cargo_enrichment_status", value: "succeeded" },
      ],
    });

    return {
      status: "written" as const,
      company_id: result.company_id,
      company_name: result.company_name,
      domain: result.domain,
      website: result.website,
      linkedin_url: result.linkedin_url,
      employee_count: result.employee_count,
    };
  },
);

export const enrichAccounts = definePlay("enrich_accounts", {
  model: crmAccounts,
  workflow: enrichCrmAccount,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmAccounts.columns.domain,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmAccounts.columns.linkedin_company_page,
            operator: "isNotEmpty",
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "date",
            columnSlug: crmAccounts.columns.cargo_last_enriched_at,
            operator: "isNull",
          },
          {
            kind: "date",
            columnSlug: crmAccounts.columns.cargo_last_enriched_at,
            operator: "lowerThan",
            value: "6 months",
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "0 6 * * *" },
});

// ---------------------------------------------------------------------------
// People path. One play orchestrates three gated tools:
// 1. Cargo-native email lookup when email is blank and LinkedIn is present.
// 2. Cargo-native LinkedIn lookup when LinkedIn is blank and email is present.
// 3. Custom LinkedIn enrichment only after a LinkedIn URL is available.
// The custom tool has no CRM access. The play owns the only CRM write.
// ---------------------------------------------------------------------------

export const crmContacts = defineModel("crm_contacts", {
  connector: crm,
  extractSlug: "fetchRecords",
  config: { objectType: "contacts", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 * * * *" },
});

// PLACEHOLDER: instantiate Cargo's native "Find Email" tool, confirm that it
// accepts linkedin_url, and replace this UUID with the deployed tool UUID.
// Confirm the release output path before deploy; this example expects `email`.
const findEmail = toolRef<{ email?: string }>(
  "REPLACE-WITH-FIND-EMAIL-TOOL-UUID",
);

// PLACEHOLDER: instantiate Cargo's native "Find LinkedIn Profile from Email"
// tool, confirm that it accepts email, and replace this UUID with the deployed
// tool UUID. Confirm the release output path before deploy; this example
// expects `linkedin_url`.
const findLinkedinProfileFromEmail = toolRef<{ linkedin_url?: string }>(
  "REPLACE-WITH-FIND-LINKEDIN-PROFILE-FROM-EMAIL-TOOL-UUID",
);

const enrichContactFromLinkedin = defineWorkflow(
  "contact_linkedin_enrichment_workflow",
  {
    input: z.object({
      linkedinUrl: z.string().optional(),
    }),
    output: z.object({
      person_id: z.string().optional(),
      job_title: z.string().optional(),
      linkedin_url: z.string().optional(),
    }),
    uses: { linkedin },
  },
  ({ input, uses }) => {
    if (!input.linkedinUrl) {
      return {};
    }

    const profileUrl = input.linkedinUrl.startsWith("http")
      ? input.linkedinUrl
      : `https://www.linkedin.com/in/${input.linkedinUrl}`;
    const profile = uses.linkedin.enrichProfile({ linkedinUrl: profileUrl });

    return {
      person_id: profile.profile_id,
      job_title: profile.job_title,
      linkedin_url: profile.linkedin_url,
    };
  },
);

export const contactLinkedinEnrichment = defineTool(
  "contact_linkedin_enrichment",
  {
    workflow: enrichContactFromLinkedin,
    name: "Contact LinkedIn enrichment",
    description:
      "Enrich one LinkedIn profile into approved contact identity and role fields without writing to a CRM.",
  },
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
        // Both identifiers already exist. Skip both native lookup tools and
        // run only the custom LinkedIn enrichment.
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

      // LinkedIn exists but email is blank. Run the native email finder, then
      // enrich the known LinkedIn profile whether or not an email resolves.
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
      // Email exists but LinkedIn is blank. Run the native resolver, stop on
      // a miss, and call the custom enrichment only with a resolved profile.
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
