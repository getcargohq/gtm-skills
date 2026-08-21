import {
  defineConnector,
  defineModel,
  definePlay,
  defineTool,
  defineWorkflow,
} from "@cargo-ai/cdk";
import { z } from "zod";

// This is the cookbook's only adaptation surface. It is a checked HubSpot
// example. When the skill runs, the agent replaces the CRM connector, model
// columns, write action, fill-blank guard, and field destinations from the live
// workspace.
const crm = defineConnector("crm", {
  integration: "hubspot",
  adopt: true,
});

// The play runs on the concrete CRM model so its row ID is safe to send back
// to that CRM. The native Account model unifies this source for downstream use.
export const crmAccounts = defineModel("crm_accounts", {
  connector: crm,
  extractSlug: "fetchRecords",
  config: { objectType: "companies", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 * * * *" },
  unification: { source: "integration" },
});

export const accounts = defineModel("accounts", {
  kind: "native",
  extractSlug: "unifyAccounts",
  config: {
    domain: "weak",
    slug: "none",
    linkedinId: "strong",
    linkedinHandle: "strong",
    crunchbaseUuid: "none",
    crunchbasePermalink: "none",
    twitterHandle: "none",
    salesNavigatorId: "none",
  },
});

const linkedin = defineConnector("linkedin", {
  integration: "linkedin",
  adopt: true,
});

// The agent replaces every placeholder with an audited CRM property. The
// workflow exits before a paid call while any placeholder remains.
const crmFields = {
  company_id: "PLACEHOLDER_LINKEDIN_COMPANY_ID_PROPERTY",
  company_name: "PLACEHOLDER_COMPANY_NAME_PROPERTY",
  domain: "PLACEHOLDER_DOMAIN_PROPERTY",
  website: "PLACEHOLDER_WEBSITE_PROPERTY",
  linkedin_url: "PLACEHOLDER_LINKEDIN_URL_PROPERTY",
  employee_count: "PLACEHOLDER_EMPLOYEE_COUNT_PROPERTY",
  last_enriched_at: "PLACEHOLDER_LAST_ENRICHED_AT_PROPERTY",
  enrichment_status: "PLACEHOLDER_ENRICHMENT_STATUS_PROPERTY",
} as const;

const hasPlaceholderFields = Object.values(crmFields).some((field) =>
  field.startsWith("PLACEHOLDER_"),
);

const enrichmentResult = z.object({
  status: z.enum([
    "written",
    "skipped_no_identifier",
    "skipped_unconfigured_fields",
  ]),
  company_id: z.string().optional(),
  company_name: z.string().optional(),
  domain: z.string().optional(),
  website: z.string().optional(),
  linkedin_url: z.string().optional(),
  employee_count: z.number().optional(),
});

const enrichAccountWorkflow = defineWorkflow(
  "account_enrichment",
  {
    input: z.object({
      crmRecordId: z.string().trim().min(1),
      linkedinUrl: z.string().optional(),
      domain: z.string().optional(),
    }),
    output: enrichmentResult,
    uses: { crm, linkedin },
    imports: { crmFields, hasPlaceholderFields },
  },
  ({ input, uses }) => {
    if (hasPlaceholderFields)
      return { status: "skipped_unconfigured_fields" as const };
    if (!input.linkedinUrl && !input.domain)
      return { status: "skipped_no_identifier" as const };

    if (input.linkedinUrl) {
      const result = uses.linkedin.enrichCompany({
        linkedinUrl: input.linkedinUrl,
      });
      uses.crm.updateRecords({
        objectType: "companies",
        matchingPropertyName: "hs_object_id",
        matchingValue: input.crmRecordId,
        mappings: [
          {
            propertyName: crmFields.company_id,
            value: result.company_id,
            skipIfExist: true,
          },
          {
            propertyName: crmFields.company_name,
            value: result.company_name,
            skipIfExist: true,
          },
          {
            propertyName: crmFields.domain,
            value: result.domain,
            skipIfExist: true,
          },
          {
            propertyName: crmFields.website,
            value: result.website,
            skipIfExist: true,
          },
          {
            propertyName: crmFields.linkedin_url,
            value: result.linkedin_url,
            skipIfExist: true,
          },
          {
            propertyName: crmFields.employee_count,
            value: result.employee_count,
            skipIfExist: true,
          },
          { propertyName: crmFields.last_enriched_at, value: new Date() },
          { propertyName: crmFields.enrichment_status, value: "succeeded" },
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
    } else if (input.domain) {
      const result = uses.linkedin.enrichCompanyFromDomain({
        domain: input.domain,
      });
      uses.crm.updateRecords({
        objectType: "companies",
        matchingPropertyName: "hs_object_id",
        matchingValue: input.crmRecordId,
        mappings: [
          {
            propertyName: crmFields.company_id,
            value: result.company_id,
            skipIfExist: true,
          },
          {
            propertyName: crmFields.company_name,
            value: result.company_name,
            skipIfExist: true,
          },
          {
            propertyName: crmFields.domain,
            value: result.domain,
            skipIfExist: true,
          },
          {
            propertyName: crmFields.website,
            value: result.website,
            skipIfExist: true,
          },
          {
            propertyName: crmFields.linkedin_url,
            value: result.linkedin_url,
            skipIfExist: true,
          },
          {
            propertyName: crmFields.employee_count,
            value: result.employee_count,
            skipIfExist: true,
          },
          { propertyName: crmFields.last_enriched_at, value: new Date() },
          { propertyName: crmFields.enrichment_status, value: "succeeded" },
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
    }
  },
);

export const accountEnrichment = defineTool("account_enrichment", {
  workflow: enrichAccountWorkflow,
});

const enrichAccountRow = defineWorkflow(
  "enrich_account_row",
  {
    // Replace these sample HubSpot columns with the audited CRM model columns.
    input: z.object({
      id: z.string().trim().min(1),
      domain: z.string().optional(),
      linkedin_company_page: z.string().optional(),
    }),
    output: enrichmentResult,
    uses: { accountEnrichment },
  },
  ({ input, uses }) =>
    uses.accountEnrichment({
      crmRecordId: input.id,
      domain: input.domain,
      linkedinUrl: input.linkedin_company_page,
    }),
);

export const enrichAccounts = definePlay("enrich_accounts", {
  model: crmAccounts,
  workflow: enrichAccountRow,
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
    ],
  },
  limit: 15,
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added", "updated"],
  schedule: { type: "cron", cron: "0 6 * * 1" },
});
