import {
  defineConnector,
  defineModel,
  definePlay,
  defineWorkflowFromNodes,
} from "@cargo-ai/cdk";

const connectorCacheTtlMilliseconds = 15 * 24 * 60 * 60 * 1000;

// Checked HubSpot example. For Salesforce or Attio, replace the connector
// integration, account extractor, record-ID field, search action, merge
// action, and property slugs. Keep one CRM shape in this file.
const crm = defineConnector("crm", {
  integration: "hubspot",
  adopt: true,
  cacheTtlMilliseconds: connectorCacheTtlMilliseconds,
});

export const crmAccounts = defineModel("crm_accounts", {
  connector: crm,
  extractSlug: "fetchRecords",
  config: { objectType: "companies", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 * * * *" },
});

const manualReviewConnector = defineConnector("manual_review", {
  integration: "slack",
  adopt: true,
  cacheTtlMilliseconds: connectorCacheTtlMilliseconds,
});
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

const prepareDuplicateEvidenceScript = `
const source = nodes.start;
const found = Array.isArray(nodes.find_duplicate_companies)
  ? nodes.find_duplicate_companies
  : [];

const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim();
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const domain = (value) =>
  text(value)
    .toLowerCase()
    .replace(/^https?:\\/\\//, "")
    .replace(/^www\\./, "")
    .split(/[/?#]/)[0]
    .replace(/:\\d+$/, "")
    .replace(/\\.$/, "");
const linkedinHandle = (value) =>
  text(value)
    .toLowerCase()
    .replace(/^(?:https?:\\/\\/)?(?:www\\.)?linkedin\\.com\\/company\\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\\/+$/, "");
const genericDomains = new Set([
  "bit.ly",
  "facebook.com",
  "github.com",
  "google.com",
  "hubs.ly",
  "instagram.com",
  "linktr.ee",
  "linkedin.com",
  "substack.com",
  "uk.com",
]);

const sourceId = text(source.hs_object_id);
const liveSource = found.find((record) => text(record && record.id) === sourceId);
if (!liveSource) {
  return {
    sourceFound: false,
    duplicateCount: 0,
    cluster: [],
    candidateEvidence: [],
    exactLinkedinId: false,
    exactLinkedinUrl: false,
    exactDomain: false,
    identityConflict: false,
    protectedIdConflict: false,
    parentOrSubsidiaryWarning: false,
    autoEligible: false,
  };
}

const unique = new Map([[sourceId, liveSource]]);
for (const record of found) {
  const id = text(record && record.id);
  if (id && id !== sourceId) unique.set(id, record);
}

const records = [...unique.values()];
const normalized = records.map((record) => {
  const properties = record.properties || {};
  const populatedProperties = Object.values(properties).filter(
    (value) => value !== null && value !== undefined && value !== "",
  ).length;
  return {
    id: text(record.id),
    linkedinId: text(properties.linkedin_company_id),
    linkedinUrl: linkedinHandle(properties.linkedin_company_page),
    domain: domain(properties.domain),
    protectedId: text(properties.protected_business_id),
    parentId: text(properties.parent_company_id),
    customer: Number(text(properties.lifecyclestage).toLowerCase() === "customer"),
    openDeals: number(properties.hs_num_open_deals),
    contacts: number(properties.num_associated_contacts),
    activities: number(properties.hs_num_engagements),
    populatedProperties,
    lastActivityAt: text(properties.notes_last_updated),
    createdAt: text(properties.createdate),
  };
});
const reference = normalized[0];
const candidates = normalized.slice(1).filter((candidate) => {
  const linkedinIdMatch =
    reference.linkedinId && candidate.linkedinId === reference.linkedinId;
  const linkedinUrlMatch =
    reference.linkedinUrl && candidate.linkedinUrl === reference.linkedinUrl;
  const domainMatch =
    reference.domain &&
    !genericDomains.has(reference.domain) &&
    candidate.domain === reference.domain;
  return Boolean(linkedinIdMatch || linkedinUrlMatch || domainMatch);
});
const cluster = [reference, ...candidates];
const distinct = (key) =>
  new Set(cluster.map((record) => record[key]).filter(Boolean));
const linkedinIds = distinct("linkedinId");
const linkedinUrls = distinct("linkedinUrl");
const domains = distinct("domain");
const protectedIds = distinct("protectedId");
const recordIds = new Set(cluster.map((record) => record.id));
const parentOrSubsidiaryWarning = cluster.some(
  (record) => record.parentId && recordIds.has(record.parentId),
);
const exactLinkedinId = Boolean(
  reference.linkedinId &&
    candidates.length > 0 &&
    candidates.every((candidate) => candidate.linkedinId === reference.linkedinId),
);
const exactLinkedinUrl = Boolean(
  reference.linkedinUrl &&
    candidates.length > 0 &&
    candidates.every((candidate) => candidate.linkedinUrl === reference.linkedinUrl),
);
const exactDomain = Boolean(
  reference.domain &&
    !genericDomains.has(reference.domain) &&
    candidates.length > 0 &&
    candidates.every((candidate) => candidate.domain === reference.domain),
);
const identityConflict =
  linkedinIds.size > 1 || linkedinUrls.size > 1 || domains.size > 1;
const protectedIdConflict = protectedIds.size > 1;

return {
  sourceFound: true,
  duplicateCount: candidates.length,
  cluster,
  candidateEvidence: cluster.map((record) => ({
    id: record.id,
    linkedinId: record.linkedinId,
    linkedinUrl: record.linkedinUrl,
    domain: record.domain,
    protectedIdPresent: Boolean(record.protectedId),
    parentId: record.parentId,
  })),
  exactLinkedinId,
  exactLinkedinUrl,
  exactDomain,
  identityConflict,
  protectedIdConflict,
  parentOrSubsidiaryWarning,
  autoEligible:
    exactLinkedinId &&
    !identityConflict &&
    !protectedIdConflict &&
    !parentOrSubsidiaryWarning,
};
`;

const selectDuplicateSurvivorScript = `
const cluster = Array.isArray(nodes.prepare_duplicate_evidence.result.cluster)
  ? nodes.prepare_duplicate_evidence.result.cluster
  : [];
const ordered = [...cluster].sort((left, right) =>
  Number(Boolean(right.protectedId)) - Number(Boolean(left.protectedId)) ||
  right.customer - left.customer ||
  right.openDeals - left.openDeals ||
  right.contacts - left.contacts ||
  right.activities - left.activities ||
  right.populatedProperties - left.populatedProperties ||
  right.lastActivityAt.localeCompare(left.lastActivityAt) ||
  left.createdAt.localeCompare(right.createdAt) ||
  left.id.localeCompare(right.id)
);
return {
  primaryId: ordered[0] ? ordered[0].id : "",
  idsToMerge: ordered.slice(1).map((record) => record.id),
};
`;

// PLACEHOLDER: replace with the approved Slack channel ID before deployment.
const manualReviewChannelId = "PLACEHOLDER_REVIEW_CHANNEL_ID";

// Direct CRM-model play. It performs a fresh HubSpot candidate search for each
// enrolled account, scores the resulting cluster, then either merges a narrow
// exact-ID class or pauses for human approval. No staging model is deployed.
const deduplicateCrmAccount = defineWorkflowFromNodes(
  "deduplicate_crm_account",
  {
    formFields: [
      {
        slug: "hs_object_id",
        name: "HubSpot company ID",
        kind: "string",
        isRequired: true,
      },
      { slug: "name", name: "Company name", kind: "string", isRequired: false },
      { slug: "domain", name: "Domain", kind: "string", isRequired: false },
      {
        slug: "linkedin_company_page",
        name: "LinkedIn company page",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "linkedin_company_id",
        name: "LinkedIn company ID",
        kind: "string",
        isRequired: false,
      },
      // PLACEHOLDER: map these two slugs to the protected-ID and parent-company
      // properties approved in the live CRM audit before deployment.
      {
        slug: "protected_business_id",
        name: "Protected business ID",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "parent_company_id",
        name: "Parent company ID",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "lifecyclestage",
        name: "Lifecycle stage",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "hs_num_open_deals",
        name: "Open deals",
        kind: "number",
        isRequired: false,
      },
      {
        slug: "num_associated_contacts",
        name: "Associated contacts",
        kind: "number",
        isRequired: false,
      },
      {
        slug: "hs_num_engagements",
        name: "Activities",
        kind: "number",
        isRequired: false,
      },
      {
        slug: "notes_last_updated",
        name: "Last activity at",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "createdate",
        name: "Created at",
        kind: "string",
        isRequired: false,
      },
    ],
    nodes: [
      {
        uuid: "20000000-0000-4000-8000-000000000001",
        slug: "start",
        kind: "native",
        actionSlug: "start",
        config: {},
        childrenUuids: ["20000000-0000-4000-8000-000000000002"],
        fallbackOnFailure: false,
        position: { x: 0, y: 0 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000002",
        slug: "find_duplicate_companies",
        name: "Find duplicate companies",
        kind: "connector",
        integrationSlug: "hubspot",
        actionSlug: "findRecords",
        connectorUuid: crm.uuid as unknown as string,
        config: {
          objectType: "companies",
          criterias: [
            {
              propertyName: "linkedin_company_id",
              value: expression("{{nodes.start.linkedin_company_id}}"),
            },
            {
              propertyName: "linkedin_company_page",
              value: expression("{{nodes.start.linkedin_company_page}}"),
            },
            {
              propertyName: "domain",
              value: expression("{{nodes.start.domain}}"),
            },
          ],
        },
        childrenUuids: ["20000000-0000-4000-8000-000000000003"],
        fallbackOnFailure: false,
        position: { x: 0, y: 166 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000003",
        slug: "prepare_duplicate_evidence",
        name: "Normalize duplicate evidence",
        kind: "native",
        actionSlug: "script",
        config: { script: prepareDuplicateEvidenceScript },
        childrenUuids: ["20000000-0000-4000-8000-000000000004"],
        fallbackOnFailure: false,
        position: { x: 0, y: 332 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000004",
        slug: "has_duplicates",
        name: "Duplicates found?",
        kind: "native",
        actionSlug: "branch",
        config: {
          condition: expression(
            "{{nodes.prepare_duplicate_evidence.result.duplicateCount > 0}}",
          ),
        },
        childrenUuids: [
          "20000000-0000-4000-8000-000000000005",
          "20000000-0000-4000-8000-00000000000d",
        ],
        fallbackOnFailure: false,
        position: { x: 0, y: 498 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000005",
        slug: "duplicate_score",
        name: "Score duplicate evidence",
        kind: "native",
        actionSlug: "scoring",
        config: {
          criterias: [
            {
              name: "Exact LinkedIn company ID",
              value: expression(
                "{{nodes.prepare_duplicate_evidence.result.exactLinkedinId}}",
              ),
              score: 60,
            },
            {
              name: "Exact LinkedIn company URL",
              value: expression(
                "{{nodes.prepare_duplicate_evidence.result.exactLinkedinUrl}}",
              ),
              score: 25,
            },
            {
              name: "Exact non-generic domain",
              value: expression(
                "{{nodes.prepare_duplicate_evidence.result.exactDomain}}",
              ),
              score: 15,
            },
          ],
        },
        childrenUuids: ["20000000-0000-4000-8000-00000000000e"],
        fallbackOnFailure: false,
        position: { x: 0, y: 664 },
      },
      {
        uuid: "20000000-0000-4000-8000-00000000000e",
        slug: "select_survivor",
        name: "Select deterministic survivor",
        kind: "native",
        actionSlug: "script",
        config: { script: selectDuplicateSurvivorScript },
        childrenUuids: ["20000000-0000-4000-8000-000000000006"],
        fallbackOnFailure: false,
        position: { x: 0, y: 830 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000006",
        slug: "automatic_merge_gate",
        name: "Safe automatic merge?",
        kind: "native",
        actionSlug: "branch",
        config: {
          condition: expression(
            "{{nodes.duplicate_score.score >= 60 && nodes.prepare_duplicate_evidence.result.autoEligible === true}}",
          ),
        },
        childrenUuids: [
          "20000000-0000-4000-8000-000000000007",
          "20000000-0000-4000-8000-000000000009",
        ],
        fallbackOnFailure: false,
        position: { x: 0, y: 996 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000007",
        slug: "merge_automatically",
        name: "Merge exact LinkedIn ID cluster",
        kind: "connector",
        integrationSlug: "hubspot",
        actionSlug: "mergeRecords",
        connectorUuid: crm.uuid as unknown as string,
        config: {
          objectType: "companies",
          primaryId: expression("{{nodes.select_survivor.result.primaryId}}"),
          idsToMerge: expression("{{nodes.select_survivor.result.idsToMerge}}"),
        },
        childrenUuids: ["20000000-0000-4000-8000-000000000008"],
        fallbackOnFailure: false,
        position: { x: -260, y: 1162 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000008",
        slug: "merged_automatically",
        kind: "native",
        actionSlug: "end",
        config: {
          variables: [
            { name: "status", type: "string", value: "merged_automatically" },
            {
              name: "score",
              type: "number",
              value: expression("{{nodes.duplicate_score.score}}"),
            },
            {
              name: "survivorId",
              type: "string",
              value: expression("{{nodes.select_survivor.result.primaryId}}"),
            },
            {
              name: "mergedIds",
              type: "array",
              value: expression("{{nodes.select_survivor.result.idsToMerge}}"),
            },
          ],
        },
        childrenUuids: [],
        fallbackOnFailure: false,
        position: { x: -260, y: 1328 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000009",
        slug: "manual_review",
        name: "Validate duplicate merge",
        kind: "native",
        actionSlug: "humanReview",
        config: {
          connectorUuid: manualReviewConnector.uuid as unknown as string,
          channelId: manualReviewChannelId,
          title: expression(
            '{{"Review CRM account merge into " + nodes.select_survivor.result.primaryId}}',
          ),
          content: expression(
            '{{"Duplicate score: " + nodes.duplicate_score.score + "/100\\nSurvivor: " + nodes.select_survivor.result.primaryId + "\\nRecords to merge: " + nodes.select_survivor.result.idsToMerge.join(", ") + "\\nIdentity conflict: " + nodes.prepare_duplicate_evidence.result.identityConflict + "\\nProtected ID conflict: " + nodes.prepare_duplicate_evidence.result.protectedIdConflict + "\\nParent/subsidiary warning: " + nodes.prepare_duplicate_evidence.result.parentOrSubsidiaryWarning + "\\nEvidence: " + JSON.stringify(nodes.prepare_duplicate_evidence.result.candidateEvidence)}}',
          ),
          timeoutMilliseconds: 86_400_000,
          enableEditButton: false,
        },
        childrenUuids: [
          "20000000-0000-4000-8000-00000000000a",
          "20000000-0000-4000-8000-00000000000c",
        ],
        fallbackOnFailure: false,
        position: { x: 260, y: 1162 },
      },
      {
        uuid: "20000000-0000-4000-8000-00000000000a",
        slug: "merge_after_review",
        name: "Merge approved cluster",
        kind: "connector",
        integrationSlug: "hubspot",
        actionSlug: "mergeRecords",
        connectorUuid: crm.uuid as unknown as string,
        config: {
          objectType: "companies",
          primaryId: expression("{{nodes.select_survivor.result.primaryId}}"),
          idsToMerge: expression("{{nodes.select_survivor.result.idsToMerge}}"),
        },
        childrenUuids: ["20000000-0000-4000-8000-00000000000b"],
        fallbackOnFailure: false,
        position: { x: 160, y: 1328 },
      },
      {
        uuid: "20000000-0000-4000-8000-00000000000b",
        slug: "merged_after_review",
        kind: "native",
        actionSlug: "end",
        config: {
          variables: [
            { name: "status", type: "string", value: "merged_after_review" },
            {
              name: "score",
              type: "number",
              value: expression("{{nodes.duplicate_score.score}}"),
            },
            {
              name: "survivorId",
              type: "string",
              value: expression("{{nodes.select_survivor.result.primaryId}}"),
            },
            {
              name: "mergedIds",
              type: "array",
              value: expression("{{nodes.select_survivor.result.idsToMerge}}"),
            },
          ],
        },
        childrenUuids: [],
        fallbackOnFailure: false,
        position: { x: 160, y: 1494 },
      },
      {
        uuid: "20000000-0000-4000-8000-00000000000c",
        slug: "review_declined",
        kind: "native",
        actionSlug: "end",
        config: {
          variables: [
            {
              name: "status",
              type: "string",
              value: "review_declined_or_timed_out",
            },
            {
              name: "score",
              type: "number",
              value: expression("{{nodes.duplicate_score.score}}"),
            },
          ],
        },
        childrenUuids: [],
        fallbackOnFailure: false,
        position: { x: 360, y: 1328 },
      },
      {
        uuid: "20000000-0000-4000-8000-00000000000d",
        slug: "no_duplicates",
        kind: "native",
        actionSlug: "end",
        config: {
          variables: [
            {
              name: "status",
              type: "string",
              value: expression(
                '{{nodes.prepare_duplicate_evidence.result.sourceFound ? "no_duplicates" : "source_missing_or_changed"}}',
              ),
            },
          ],
        },
        childrenUuids: [],
        fallbackOnFailure: false,
        position: { x: 280, y: 664 },
      },
    ],
  },
);

export const deduplicateAccounts = definePlay("deduplicate_accounts", {
  model: crmAccounts,
  workflow: deduplicateCrmAccount,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: crmAccounts.columns.hs_object_id,
            operator: "isNotEmpty",
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmAccounts.columns.linkedin_company_id,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmAccounts.columns.linkedin_company_page,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmAccounts.columns.domain,
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
  schedule: { type: "cron", cron: "0 7 * * *" },
});
