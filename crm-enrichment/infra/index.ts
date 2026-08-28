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

export type AccountCandidate = {
  id: string;
  linkedinId?: string;
  linkedinUrl?: string;
  domain?: string;
  protectedId?: string;
  isJunkDomain?: boolean;
  parentOrSubsidiaryWarning?: boolean;
  isCustomer: boolean;
  openOpportunities: number;
  contacts: number;
  activities: number;
  populatedProperties: number;
  lastActivityAt?: string;
  createdAt: string;
};

export const normalizeDomain = (value?: string) =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "")
    .replace(/\.$/, "") ?? "";

export const normalizeLinkedInId = (value?: string) => value?.trim() ?? "";

export const normalizeLinkedInHandle = (value?: string) =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/company\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "") || "";

export const selectSurvivor = (records: AccountCandidate[]) =>
  [...records].sort(
    (a, b) =>
      Number(Boolean(b.protectedId)) - Number(Boolean(a.protectedId)) ||
      Number(b.isCustomer) - Number(a.isCustomer) ||
      b.openOpportunities - a.openOpportunities ||
      b.contacts - a.contacts ||
      b.activities - a.activities ||
      b.populatedProperties - a.populatedProperties ||
      (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "") ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  )[0];

export const classifyCluster = (records: AccountCandidate[]) => {
  if (records.length < 2)
    throw new Error("Duplicate clusters require at least two records");
  if (records.some((record) => !record.id.trim()))
    throw new Error("Every duplicate candidate requires a non-empty record ID");
  if (
    new Set(records.map((record) => record.id.trim())).size !== records.length
  )
    throw new Error("Duplicate clusters require distinct source record IDs");

  const linkedinIds = new Set(
    records
      .map((record) => normalizeLinkedInId(record.linkedinId))
      .filter(Boolean),
  );
  const linkedinHandles = new Set(
    records
      .map((record) => normalizeLinkedInHandle(record.linkedinUrl))
      .filter(Boolean),
  );
  const domains = new Set(
    records.map((record) => normalizeDomain(record.domain)).filter(Boolean),
  );
  const protectedIds = new Set(
    records.map((record) => record.protectedId?.trim()).filter(Boolean),
  );
  const identityConflict =
    linkedinIds.size > 1 || linkedinHandles.size > 1 || domains.size > 1;
  const protectedIdConflict = protectedIds.size > 1;
  const hasJunkDomain = records.some((record) => record.isJunkDomain);
  const hasParentOrSubsidiaryWarning = records.some(
    (record) => record.parentOrSubsidiaryWarning,
  );
  const matchClass =
    identityConflict || protectedIdConflict
      ? "conflict"
      : hasParentOrSubsidiaryWarning
        ? "parent_or_subsidiary_review"
        : linkedinIds.size === 1 &&
            records.every((record) => normalizeLinkedInId(record.linkedinId))
          ? "exact_unique_linkedin"
          : linkedinHandles.size === 1 &&
              records.every((record) =>
                normalizeLinkedInHandle(record.linkedinUrl),
              )
            ? "linkedin_url_review"
            : hasJunkDomain
              ? "junk_domain_review"
              : domains.size === 1 &&
                  records.every((record) => normalizeDomain(record.domain))
                ? "domain_review"
                : "conflict";

  return {
    matchClass,
    identityConflict,
    protectedIdConflict,
    hasJunkDomain,
    hasParentOrSubsidiaryWarning,
    survivor: selectSurvivor(records),
  };
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

// The read-only duplicate audit classifies crm_accounts clusters with the pure
// helpers above, then materializes reviewed candidates into this native model.
// The proposal play consumes clusters instead of individual CRM rows because a
// row cannot carry the full evidence needed for a survivor decision.
export const accountDuplicateCandidates = defineModel(
  "account_duplicate_candidates",
  {
    kind: "native",
    extractSlug: "defineCustom",
    config: {
      columns: [
        { slug: "audit_run_id", type: "string" },
        { slug: "cluster_id", type: "string" },
        { slug: "source_model_slug", type: "string" },
        { slug: "ordered_record_ids", type: "array" },
        { slug: "survivor_id", type: "string" },
        { slug: "match_class", type: "string" },
        { slug: "normalized_linkedin_id", type: "string" },
        { slug: "identity_conflict", type: "boolean" },
        { slug: "protected_id_conflict", type: "boolean" },
        { slug: "stale", type: "boolean" },
      ],
    },
  },
);

const proposeDuplicateCluster = defineWorkflow(
  "propose_duplicate_account_cluster",
  {
    input: z.object({
      audit_run_id: z.string().trim().min(1),
      cluster_id: z.string().trim().min(1),
      source_model_slug: z.literal("crm_accounts"),
      ordered_record_ids: z.array(z.string().trim().min(1)).min(2),
      survivor_id: z.string().trim().min(1),
      match_class: z.string(),
      normalized_linkedin_id: z.string(),
      identity_conflict: z.boolean(),
      protected_id_conflict: z.boolean(),
      stale: z.boolean(),
    }),
    output: z.object({
      approvedForMerge: z.boolean(),
      reason: z.string(),
      auditRunId: z.string(),
      survivorId: z.string(),
      orderedRecordIds: z.array(z.string()),
    }),
  },
  ({ input }) => {
    if (input.stale)
      return {
        approvedForMerge: false,
        reason: "stale_live_reread",
        auditRunId: input.audit_run_id,
        survivorId: input.survivor_id,
        orderedRecordIds: input.ordered_record_ids,
      };
    if (input.identity_conflict || input.protected_id_conflict)
      return {
        approvedForMerge: false,
        reason: "identity_or_protected_id_conflict",
        auditRunId: input.audit_run_id,
        survivorId: input.survivor_id,
        orderedRecordIds: input.ordered_record_ids,
      };
    if (
      input.match_class !== "exact_unique_linkedin" ||
      !input.normalized_linkedin_id
    )
      return {
        approvedForMerge: false,
        reason: "review_only_match_class",
        auditRunId: input.audit_run_id,
        survivorId: input.survivor_id,
        orderedRecordIds: input.ordered_record_ids,
      };
    return {
      approvedForMerge: false,
      reason: "mandatory_live_guard_not_implemented",
      auditRunId: input.audit_run_id,
      survivorId: input.survivor_id,
      orderedRecordIds: input.ordered_record_ids,
    };
  },
);

export const deduplicateAccounts = definePlay("deduplicate_accounts", {
  model: accountDuplicateCandidates,
  workflow: proposeDuplicateCluster,
  limit: 15,
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added", "updated"],
});
