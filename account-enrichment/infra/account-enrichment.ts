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

// Replace this key with the audited key from the native Account `ids` object.
// Cargo formats it as "<dataset_slug>__<model_slug>".
const crmSourceKey = "PLACEHOLDER_CRM_DATASET_AND_MODEL_SLUG";

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

const hasPlaceholderFields =
  crmSourceKey.startsWith("PLACEHOLDER_") ||
  Object.values(crmFields).some((field) => field.startsWith("PLACEHOLDER_"));

// The CRM model supplies Account identity, the writeback target, and the live
// freshness value projected onto the unified Account below.
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
  // `additionalColumns` is authoritative. Before deployment, merge every
  // existing Account additional column into this list and require the plan to
  // show no unrelated column removals.
  additionalColumns: [
    {
      kind: "computed",
      slug: "crm_record_id",
      type: "string",
      label: "CRM record ID",
      description:
        "Original CRM record ID selected from the unified Account source map.",
      expression: {
        kind: "jsExpression",
        instructTo: "none",
        expression: `{{ ids?.[${JSON.stringify(crmSourceKey)}] ?? null }}`,
        fromRecipe: false,
      },
      columnsUsed: ["ids"],
    },
    {
      kind: "lookup",
      slug: "crm_last_enriched_at",
      type: "date",
      label: "CRM last enriched at",
      description:
        "Live CRM freshness used by the Account play's managed segment.",
      join: {
        model: crmAccounts,
        fromColumnSlug: "computed__crm_record_id",
        toColumnSlug: "id",
      },
      extractColumnSlug: crmFields.last_enriched_at,
    },
  ],
});

const linkedin = defineConnector("linkedin", {
  integration: "linkedin",
  adopt: true,
});

const enrichmentResult = z.object({
  status: z.enum([
    "written",
    "skipped_no_crm_record",
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
      sourceIds: z.record(z.string(), z.string()),
      linkedinHandle: z.string().optional(),
      domain: z.string().optional(),
    }),
    output: enrichmentResult,
    uses: { crm, linkedin },
    imports: { crmFields, crmSourceKey, hasPlaceholderFields },
  },
  ({ input, uses }) => {
    if (hasPlaceholderFields)
      return { status: "skipped_unconfigured_fields" as const };
    const crmRecordId = input.sourceIds[crmSourceKey];
    if (!crmRecordId) return { status: "skipped_no_crm_record" as const };
    if (!input.linkedinHandle && !input.domain)
      return { status: "skipped_no_identifier" as const };

    if (input.linkedinHandle) {
      const result = uses.linkedin.enrichCompany({
        linkedinUrl: `https://www.linkedin.com/company/${input.linkedinHandle}`,
      });
      uses.crm.updateRecords({
        objectType: "companies",
        matchingPropertyName: "hs_object_id",
        matchingValue: crmRecordId,
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
        matchingValue: crmRecordId,
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
    } else {
      return { status: "skipped_no_identifier" as const };
    }
  },
);

export const accountEnrichment = defineTool("account_enrichment", {
  workflow: enrichAccountWorkflow,
});

const enrichAccountRow = defineWorkflow(
  "enrich_account_row",
  {
    // These are native unified Account columns, including the source ID map.
    input: z.object({
      domain: z.string().optional(),
      linkedin_handle: z.string().optional(),
      ids: z.record(z.string(), z.string()),
    }),
    output: enrichmentResult,
    uses: { accountEnrichment },
  },
  ({ input, uses }) =>
    uses.accountEnrichment({
      sourceIds: input.ids,
      domain: input.domain,
      linkedinHandle: input.linkedin_handle,
    }),
);

export const enrichAccounts = definePlay("enrich_accounts", {
  model: accounts,
  workflow: enrichAccountRow,
  filter: {
    conjonction: "and",
    groups: [
      {
        // Only enrich unified Accounts that map back to the selected CRM model.
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: accounts.columns.computed__crm_record_id,
            operator: "isNotEmpty",
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: accounts.columns.domain,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: accounts.columns.linkedin_handle,
            operator: "isNotEmpty",
          },
        ],
      },
      {
        // A row is added to the managed segment when it has never been
        // enriched or when its successful enrichment becomes six months old.
        conjonction: "or",
        conditions: [
          {
            kind: "date",
            columnSlug: accounts.columns.lookup__crm_last_enriched_at,
            operator: "isNull",
          },
          {
            kind: "date",
            columnSlug: accounts.columns.lookup__crm_last_enriched_at,
            operator: "lowerThan",
            value: "6 months",
          },
        ],
      },
    ],
  },
  limit: 15,
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "0 6 * * *" },
});
