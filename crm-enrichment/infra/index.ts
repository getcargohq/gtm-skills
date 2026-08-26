import {
  defineConnector,
  defineModel,
  definePlay,
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

const enrichCrmAccount = defineWorkflow(
  "enrich_crm_account",
  {
    input: z.object({
      hs_object_id: z.string(),
      name: z.string().optional(),
      domain: z.string().optional(),
      website: z.string().optional(),
      linkedin_company_page: z.string().optional(),
      numberofemployees: z.number().optional(),
    }),
    output: z.object({
      status: z.enum([
        "written",
        "skipped_no_identifier",
        "skipped_already_filled",
      ]),
      company_id: z.string().optional(),
      company_name: z.string().optional(),
      domain: z.string().optional(),
      website: z.string().optional(),
      linkedin_url: z.string().optional(),
      employee_count: z.number().optional(),
    }),
    uses: { crm, linkedin },
  },
  ({ input, uses }) => {
    // Skip if the account has no identifier
    if (!input.linkedin_company_page && !input.domain) {
      return { status: "skipped_no_identifier" as const };
    }

    // Skip the paid call when the approved destinations are already populated.
    // Numeric zero counts as filled. Freshness is the play filter, not this
    // guard: a succeeded stamp older than six months must still re-enroll.
    if (
      input.name &&
      input.domain &&
      input.website &&
      input.linkedin_company_page &&
      input.numberofemployees != null
    ) {
      return { status: "skipped_already_filled" as const };
    }

    // Format the LinkedIn URL. Empty string means domain fallback.
    const linkedinUrl =
      !input.linkedin_company_page ||
      input.linkedin_company_page.startsWith("http")
        ? input.linkedin_company_page
        : `https://www.linkedin.com/company/${input.linkedin_company_page}`;

    // Enrich the account
    const result = linkedinUrl
      ? uses.linkedin.enrichCompany({
          linkedinUrl,
        })
      : uses.linkedin.enrichCompanyFromDomain({
          domain: input.domain,
        });

    // Update the account in the CRM
    uses.crm.updateRecords({
      objectType: "companies",
      matchingPropertyName: "hs_object_id",
      matchingValue: input.hs_object_id,
      mappings: [
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
        // Skip the paid call when the approved destinations are already
        // populated. Numeric zero counts as filled.
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmAccounts.columns.name,
            operator: "isEmpty",
          },
          {
            kind: "string",
            columnSlug: crmAccounts.columns.domain,
            operator: "isEmpty",
          },
          {
            kind: "string",
            columnSlug: crmAccounts.columns.website,
            operator: "isEmpty",
          },
          {
            kind: "string",
            columnSlug: crmAccounts.columns.linkedin_company_page,
            operator: "isEmpty",
          },
          {
            kind: "number",
            columnSlug: crmAccounts.columns.numberofemployees,
            operator: "isNull",
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
