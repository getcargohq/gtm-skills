import {
  defineConnector,
  defineModel,
  definePlay,
  defineTool,
  defineWorkflow,
  defineWorkflowFromNodes,
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

type EnrichmentInput = {
  linkedinUrlOrHandle?: string;
  domain?: string;
};

type EnrichmentOutput = {
  company_id?: string;
  company_name?: string;
  domain?: string;
  website?: string;
  linkedin_url?: string;
  employee_count?: number;
};

const expression = (value: string) => ({
  kind: "templateExpression" as const,
  expression: value,
  instructTo: "none",
  fromRecipe: false,
});

const outputVariables = (nodeSlug: string) => [
  {
    name: "company_id",
    type: "string",
    value: expression(`{{nodes.${nodeSlug}.company_id}}`),
  },
  {
    name: "company_name",
    type: "string",
    value: expression(`{{nodes.${nodeSlug}.company_name}}`),
  },
  {
    name: "domain",
    type: "string",
    value: expression(`{{nodes.${nodeSlug}.domain}}`),
  },
  {
    name: "website",
    type: "string",
    value: expression(`{{nodes.${nodeSlug}.website}}`),
  },
  {
    name: "linkedin_url",
    type: "string",
    value: expression(`{{nodes.${nodeSlug}.linkedin_url}}`),
  },
  {
    name: "employee_count",
    type: "number",
    value: expression(`{{nodes.${nodeSlug}.employee_count}}`),
  },
];

// Deliberate raw graph: the current defineWorkflow API has no Filter helper,
// and its JavaScript conditionals compile to Branch nodes. This preserves the
// required native Filter as the first gate while keeping provider calls exclusive.
const enrichCompanyData = defineWorkflowFromNodes<
  EnrichmentInput,
  EnrichmentOutput
>("account_enrichment_workflow", {
  formFields: [
    {
      slug: "linkedinUrlOrHandle",
      name: "LinkedIn URL or handle",
      kind: "string",
      isRequired: false,
    },
    {
      slug: "domain",
      name: "Domain",
      kind: "string",
      isRequired: false,
    },
  ],
  nodes: [
    {
      uuid: "10000000-0000-4000-8000-000000000001",
      slug: "start",
      kind: "native",
      actionSlug: "start",
      config: {},
      childrenUuids: ["10000000-0000-4000-8000-000000000002"],
      fallbackOnFailure: false,
      position: { x: 0, y: 0 },
    },
    {
      uuid: "10000000-0000-4000-8000-000000000002",
      slug: "has_identifier",
      name: "Has LinkedIn or domain identifier",
      kind: "native",
      actionSlug: "filter",
      config: {
        filter: expression(
          '{{(nodes.start.linkedinUrlOrHandle !== undefined && nodes.start.linkedinUrlOrHandle !== null && nodes.start.linkedinUrlOrHandle !== "") || (nodes.start.domain !== undefined && nodes.start.domain !== null && nodes.start.domain !== "")}}',
        ),
      },
      childrenUuids: ["10000000-0000-4000-8000-000000000003"],
      fallbackOnFailure: false,
      position: { x: 0, y: 166 },
    },
    {
      uuid: "10000000-0000-4000-8000-000000000003",
      slug: "prefer_linkedin",
      name: "Prefer LinkedIn URL",
      kind: "native",
      actionSlug: "branch",
      config: {
        condition: expression(
          '{{nodes.start.linkedinUrlOrHandle !== undefined && nodes.start.linkedinUrlOrHandle !== null && nodes.start.linkedinUrlOrHandle !== ""}}',
        ),
      },
      childrenUuids: [
        "10000000-0000-4000-8000-000000000004",
        "10000000-0000-4000-8000-000000000005",
      ],
      fallbackOnFailure: false,
      position: { x: 0, y: 332 },
    },
    {
      uuid: "10000000-0000-4000-8000-000000000004",
      slug: "enrich_by_linkedin",
      name: "Enrich company from LinkedIn",
      kind: "connector",
      integrationSlug: "linkedin",
      actionSlug: "enrichCompany",
      connectorUuid: linkedin.uuid as unknown as string,
      config: {
        linkedinUrl: expression(
          '{{nodes.start.linkedinUrlOrHandle.startsWith("http") ? nodes.start.linkedinUrlOrHandle : `https://www.linkedin.com/company/${nodes.start.linkedinUrlOrHandle}`}}',
        ),
      },
      childrenUuids: ["10000000-0000-4000-8000-000000000006"],
      fallbackOnFailure: false,
      position: { x: -220, y: 498 },
    },
    {
      uuid: "10000000-0000-4000-8000-000000000005",
      slug: "enrich_by_domain",
      name: "Enrich company from domain",
      kind: "connector",
      integrationSlug: "linkedin",
      actionSlug: "enrichCompanyFromDomain",
      connectorUuid: linkedin.uuid as unknown as string,
      config: { domain: expression("{{nodes.start.domain}}") },
      childrenUuids: ["10000000-0000-4000-8000-000000000007"],
      fallbackOnFailure: false,
      position: { x: 220, y: 498 },
    },
    {
      uuid: "10000000-0000-4000-8000-000000000006",
      slug: "end_linkedin",
      kind: "native",
      actionSlug: "end",
      config: { variables: outputVariables("enrich_by_linkedin") },
      childrenUuids: [],
      fallbackOnFailure: false,
      position: { x: -220, y: 664 },
    },
    {
      uuid: "10000000-0000-4000-8000-000000000007",
      slug: "end_domain",
      kind: "native",
      actionSlug: "end",
      config: { variables: outputVariables("enrich_by_domain") },
      childrenUuids: [],
      fallbackOnFailure: false,
      position: { x: 220, y: 664 },
    },
  ],
});

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
