import {
  defineConnector,
  defineModel,
  definePlay,
  defineTool,
  defineWorkflow,
} from "@cargo-ai/cdk";
import { z } from "zod";

// Checked HubSpot example. For Salesforce or Attio, replace the connector
// integration, the account extractor (HubSpot object: companies), the
// record-id field, the write action, and the fill-blank guard. Keep one
// CRM shape in this file.
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
    // Keep the reusable tool safe when called outside the play. The play's
    // managed segment already excludes rows without either identifier.
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
    // The managed segment trigger owns identifier and freshness eligibility.
    // Per-field write policy decides fill blank versus refresh selected.
    const result = uses.accountEnrichment({
      linkedinUrlOrHandle: input.linkedin_company_page,
      domain: input.domain,
    });

    // Only the play workflow writes the approved result back to the CRM.
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
// People path. Same discipline as the account path above: the tool enriches
// without CRM access, the plays orchestrate and own every CRM read and write,
// and both plays run directly on the CRM contact extract matching
// hs_object_id. One CRM shape in this file: HubSpot is the checked example.
// ---------------------------------------------------------------------------

export const crmContacts = defineModel("crm_contacts", {
  connector: crm,
  extractSlug: "fetchRecords",
  config: { objectType: "contacts", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 * * * *" },
});

const fullenrich = defineConnector("fullenrich", {
  integration: "FullEnrich",
  adopt: true,
});

// PLACEHOLDER: the provider result paths below (profile_id, currentRole.title,
// currentCompany.id, linkedin_url) could not be verified from this repository.
// currentCompany.name and currentCompany.domain are documented upstream
// (cargo-skills linkedin-url-lookup recipe). Re-read the live output schemas of
// linkedin.enrichProfile and FullEnrich.reverseEmailLookup before deploying,
// and fix these paths at the field-selection gate.
const enrichContactData = defineWorkflow(
  "contact_enrichment_workflow",
  {
    input: z.object({
      linkedinUrl: z.string().optional(),
      email: z.string().optional(),
    }),
    output: z.object({
      person_id: z.string().optional(),
      job_title: z.string().optional(),
      linkedin_url: z.string().optional(),
      company_id: z.string().optional(),
      company_name: z.string().optional(),
      company_domain: z.string().optional(),
    }),
    uses: { linkedin, fullenrich },
  },
  ({ input, uses }) => {
    // Keep the reusable tool safe when called outside the plays. Both play
    // filters already exclude rows without either identifier.
    if (!input.linkedinUrl && !input.email) {
      return {};
    }

    if (input.linkedinUrl) {
      const profileUrl = input.linkedinUrl.startsWith("http")
        ? input.linkedinUrl
        : `https://www.linkedin.com/in/${input.linkedinUrl}`;
      const profile = uses.linkedin.enrichProfile({ linkedinUrl: profileUrl });

      return {
        person_id: profile.profile_id,
        job_title: profile.currentRole?.title,
        linkedin_url: profileUrl,
        company_id: profile.currentCompany?.id,
        company_name: profile.currentCompany?.name,
        company_domain: profile.currentCompany?.domain,
      };
    }

    const resolved = uses.fullenrich.reverseEmailLookup({
      email: input.email,
    });

    // The resolver found no profile: end without the person-enrich call so
    // the row takes at most one full paid chain.
    if (!resolved.linkedin_url) {
      return {};
    }

    const profile = uses.linkedin.enrichProfile({
      linkedinUrl: resolved.linkedin_url,
    });

    return {
      person_id: profile.profile_id,
      job_title: profile.currentRole?.title,
      linkedin_url: resolved.linkedin_url,
      company_id: profile.currentCompany?.id,
      company_name: profile.currentCompany?.name,
      company_domain: profile.currentCompany?.domain,
    };
  },
);

export const contactEnrichment = defineTool("contact_enrichment", {
  workflow: enrichContactData,
  name: "Contact enrichment",
  description:
    "Normalize a person identifier, resolve a LinkedIn profile from an email when needed, and return enriched person data without writing to a CRM.",
});

const enrichCrmContact = defineWorkflow(
  "enrich_crm_contact",
  {
    input: z.object({
      hs_object_id: z.string(),
      email: z.string().optional(),
      linkedin_profile_url: z.string().optional(),
      linkedin_person_id: z.string().optional(),
      jobtitle: z.string().optional(),
    }),
    output: z.object({
      status: z.literal("written"),
      person_id: z.string().optional(),
      job_title: z.string().optional(),
      linkedin_url: z.string().optional(),
    }),
    uses: { crm, contactEnrichment },
  },
  ({ input, uses }) => {
    // The managed segment trigger owns identifier, customer-status, and
    // freshness eligibility. Per-field write policy fills approved blanks.
    const result = uses.contactEnrichment({
      linkedinUrl: input.linkedin_profile_url,
      email: input.email,
    });

    // Only the play workflow writes the approved result back to the CRM.
    uses.crm.updateRecords({
      objectType: "contacts",
      matchingPropertyName: "hs_object_id",
      matchingValue: input.hs_object_id,
      mappings: [
        {
          propertyName: "linkedin_person_id",
          value: result.person_id,
          skipIfExist: true,
        },
        {
          propertyName: "linkedin_profile_url",
          value: result.linkedin_url,
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
      person_id: result.person_id,
      job_title: result.job_title,
      linkedin_url: result.linkedin_url,
    };
  },
);

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
      // Non-customer contacts only: monitor_champions owns the customer book
      // on its faster cadence. The audited customer-status mapping replaces
      // lifecyclestage = customer when the live CRM marks customers elsewhere.
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmContacts.columns.lifecyclestage,
            operator: "isEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.lifecyclestage,
            operator: "isNot",
            values: ["customer"],
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
      // At least one approved destination is still blank. Remove this group
      // only for an operator-approved refresh of populated stale fields.
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_person_id,
            operator: "isEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_profile_url,
            operator: "isEmpty",
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

const slack = defineConnector("slack", {
  integration: "slack",
  adopt: true,
});

// PLACEHOLDER: replace with the Slack channel that receives champion
// job-change alerts, resolved from the live workspace before deploying.
const championAlertChannelId = "REPLACE-WITH-SLACK-CHANNEL-ID";

const monitorCrmChampion = defineWorkflow(
  "monitor_crm_champion",
  {
    input: z.object({
      hs_object_id: z.string(),
      email: z.string().optional(),
      linkedin_profile_url: z.string().optional(),
      jobtitle: z.string().optional(),
      associatedcompanyid: z.string().optional(),
      firstname: z.string().optional(),
      lastname: z.string().optional(),
    }),
    output: z.object({
      status: z.enum([
        "left_no_new_company",
        "active_same_company",
        "job_change_updated",
        "job_change_company_missing",
      ]),
      target_contact_id: z.string().optional(),
      new_company_id: z.string().optional(),
    }),
    uses: { crm, slack, contactEnrichment },
    imports: { championAlertChannelId },
  },
  ({ input, uses }) => {
    // The play filter owns eligibility: customer-status mapping, primary
    // company link, identifier, and the 30-day freshness window.
    const enriched = uses.contactEnrichment({
      linkedinUrl: input.linkedin_profile_url,
      email: input.email,
    });

    // The contact's primary company record: identity for the comparison,
    // name and owner for the alert. The filter guarantees the link exists.
    const crmCompanies = uses.crm.findRecords({
      objectType: "companies",
      criterias: [
        { propertyName: "hs_object_id", value: input.associatedcompanyid },
      ],
    });
    const crmCompany = crmCompanies[0];

    // LinkedIn shows no current company: mark Left, keep the association,
    // and let the next cycle retry.
    if (!enriched.company_id && !enriched.company_domain) {
      uses.crm.updateRecords({
        objectType: "contacts",
        matchingPropertyName: "hs_object_id",
        matchingValue: input.hs_object_id,
        mappings: [
          { propertyName: "primary_employment_status", value: "Left" },
          { propertyName: "cargo_last_enriched_at", value: new Date() },
          { propertyName: "cargo_enrichment_status", value: "succeeded" },
        ],
      });

      return {
        status: "left_no_new_company" as const,
        target_contact_id: input.hs_object_id,
      };
    }

    // Same-company test, LinkedIn company ID first, domain second. A work
    // email or its domain is never the person identity or the job-change
    // proof.
    const sameCompany =
      enriched.company_id && crmCompany?.properties.linkedin_company_id
        ? enriched.company_id === crmCompany.properties.linkedin_company_id
        : enriched.company_domain &&
          crmCompany?.properties.domain &&
          enriched.company_domain.toLowerCase() ===
            crmCompany.properties.domain.toLowerCase();

    if (sameCompany) {
      uses.crm.updateRecords({
        objectType: "contacts",
        matchingPropertyName: "hs_object_id",
        matchingValue: input.hs_object_id,
        mappings: [
          {
            propertyName: "linkedin_person_id",
            value: enriched.person_id,
            skipIfExist: true,
          },
          {
            propertyName: "linkedin_profile_url",
            value: enriched.linkedin_url,
            skipIfExist: true,
          },
          {
            propertyName: "jobtitle",
            value: enriched.job_title,
            skipIfExist: true,
          },
          { propertyName: "primary_employment_status", value: "Active" },
          { propertyName: "cargo_last_enriched_at", value: new Date() },
          { propertyName: "cargo_enrichment_status", value: "succeeded" },
        ],
      });

      return {
        status: "active_same_company" as const,
        target_contact_id: input.hs_object_id,
      };
    }

    // Job change. Find the new company in the CRM: LinkedIn company ID
    // first, domain second. The no-match literals keep an empty identifier
    // from matching arbitrary records.
    const newCompaniesById = uses.crm.findRecords({
      objectType: "companies",
      criterias: [
        {
          propertyName: "linkedin_company_id",
          value: enriched.company_id || "cargo-no-linkedin-company-id",
        },
      ],
    });
    const newCompaniesByDomain = uses.crm.findRecords({
      objectType: "companies",
      criterias: [
        {
          propertyName: "domain",
          value: enriched.company_domain || "cargo-no-company-domain",
        },
      ],
    });
    const newCompany = newCompaniesById[0] ?? newCompaniesByDomain[0];

    // One person is one contact. If another contact already holds this
    // LinkedIn identity, update that record; never create, merge, or delete
    // a contact here.
    const duplicateContacts = uses.crm.findRecords({
      objectType: "contacts",
      criterias: [
        {
          propertyName: "linkedin_person_id",
          value: enriched.person_id || "cargo-no-linkedin-person-id",
        },
      ],
    });
    const targetContactId = duplicateContacts[0]
      ? duplicateContacts[0].id
      : input.hs_object_id;

    if (newCompany) {
      // Setting associatedcompanyid moves the primary association; HubSpot
      // keeps the former company as a non-primary association. Verify that
      // retention on the live portal before enabling.
      uses.crm.updateRecords({
        objectType: "contacts",
        matchingPropertyName: "hs_object_id",
        matchingValue: targetContactId,
        mappings: [
          { propertyName: "associatedcompanyid", value: newCompany.id },
          { propertyName: "jobtitle", value: enriched.job_title },
          {
            propertyName: "linkedin_person_id",
            value: enriched.person_id,
            skipIfExist: true,
          },
          {
            propertyName: "linkedin_profile_url",
            value: enriched.linkedin_url,
            skipIfExist: true,
          },
          { propertyName: "primary_employment_status", value: "Active" },
          { propertyName: "cargo_last_enriched_at", value: new Date() },
          { propertyName: "cargo_enrichment_status", value: "succeeded" },
        ],
      });

      // PLACEHOLDER: confirm the live postMessage input field names with
      // cargo-ai cdk types before deploying.
      uses.slack.postMessage({
        channelId: championAlertChannelId,
        message: `JOB CHANGE\n${input.firstname} ${input.lastname} moved from ${crmCompany?.properties.name} to ${newCompany.properties.name}.\nPrevious role: ${input.jobtitle}\nNew role: ${enriched.job_title}\nPrevious work email: ${input.email}\nSource: LinkedIn enrichment\nContact record: ${targetContactId}\nPrevious company record: ${input.associatedcompanyid} (owner: ${crmCompany?.properties.hubspot_owner_id})\nNew company record: ${newCompany.id}`,
      });

      return {
        status: "job_change_updated" as const,
        target_contact_id: targetContactId,
        new_company_id: newCompany.id,
      };
    }

    // The new employer is not in the CRM and record creation is not part of
    // the checked example. Keep the association, mark the departure, and
    // alert the former customer account's owner with the full context.
    uses.crm.updateRecords({
      objectType: "contacts",
      matchingPropertyName: "hs_object_id",
      matchingValue: input.hs_object_id,
      mappings: [
        { propertyName: "primary_employment_status", value: "Left" },
        { propertyName: "cargo_last_enriched_at", value: new Date() },
        { propertyName: "cargo_enrichment_status", value: "partial" },
      ],
    });

    uses.slack.postMessage({
      channelId: championAlertChannelId,
      message: `JOB CHANGE\n${input.firstname} ${input.lastname} left ${crmCompany?.properties.name} for ${enriched.company_name} (${enriched.company_domain}), which is not in the CRM.\nPrevious role: ${input.jobtitle}\nNew role: ${enriched.job_title}\nPrevious work email: ${input.email}\nSource: LinkedIn enrichment\nContact record: ${input.hs_object_id}\nPrevious company record: ${input.associatedcompanyid} (owner: ${crmCompany?.properties.hubspot_owner_id})\nCreate the company, then let the next cycle finish the move.`,
    });

    return {
      status: "job_change_company_missing" as const,
      target_contact_id: input.hs_object_id,
    };
  },
);

export const monitorChampions = definePlay("monitor_champions", {
  model: crmContacts,
  workflow: monitorCrmChampion,
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
      // The audited customer-status mapping: contacts whose primary company
      // is a customer. HubSpot's checked example relies on the native
      // company-to-contact lifecycle sync; verify it on the live portal.
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: crmContacts.columns.lifecyclestage,
            operator: "is",
            values: ["customer"],
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.associatedcompanyid,
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
            value: "30 days",
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "0 8 * * *" },
});
