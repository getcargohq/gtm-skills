import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
const infra = await import(`../infra/index.ts?contract=${Date.now()}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

const nodesFor = (id) => {
  const resource = byId.get(id);
  assert.ok(resource, `${id} must exist`);
  assert.ok(Array.isArray(resource.spec.nodes), `${id} must have workflow nodes`);
  return resource.spec.nodes;
};

const findOne = (nodes, predicate, message) => {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, message);
  return matches[0];
};

const child = (nodes, node) =>
  nodes.find((candidate) => candidate.uuid === node.childrenUuids[0]);

for (const connectorId of [
  "connector:crm",
  "connector:linkedin",
  "connector:manual_review",
]) {
  assert.equal(
    byId.get(connectorId)?.spec.cacheTtlMilliseconds,
    15 * 24 * 60 * 60 * 1000,
    `${connectorId} must keep the maximum 15-day cache duration`,
  );
}

const toolNodes = nodesFor("tool:account_enrichment");
const toolStart = findOne(
  toolNodes,
  (node) => node.kind === "native" && node.actionSlug === "start",
  "account_enrichment must have one start node",
);
const identifierFilter = child(toolNodes, toolStart);
assert.equal(
  identifierFilter?.kind,
  "native",
  "the tool's first node must be native",
);
assert.equal(
  identifierFilter?.actionSlug,
  "filter",
  "the tool's first node must be a Filter",
);

const providerBranch = child(toolNodes, identifierFilter);
assert.equal(
  providerBranch?.actionSlug,
  "branch",
  "provider routing must follow the identifier Filter",
);

const providerNodes = toolNodes.filter(
  (node) => node.kind === "connector" && node.integrationSlug === "linkedin",
);
assert.deepEqual(
  new Set(providerNodes.map((node) => node.actionSlug)),
  new Set(["enrichCompany", "enrichCompanyFromDomain"]),
  "the tool must expose exactly the LinkedIn-first and domain-fallback routes",
);
assert.deepEqual(
  new Set(providerBranch.childrenUuids),
  new Set(providerNodes.map((node) => node.uuid)),
  "the provider actions must be mutually exclusive Branch children",
);
assert.equal(
  toolNodes.some(
    (node) =>
      node.kind === "connector" &&
      node.connectorUuid?.resourceId === "connector:crm",
  ),
  false,
  "account_enrichment must not contain CRM connector nodes",
);

const playNodes = nodesFor("play:enrich_accounts");
const playStart = findOne(
  playNodes,
  (node) => node.kind === "native" && node.actionSlug === "start",
  "enrich_accounts must have one start node",
);
const toolCall = findOne(
  playNodes,
  (node) =>
    node.kind === "tool" &&
    node.toolUuid?.resourceId === "tool:account_enrichment",
  "enrich_accounts must contain exactly one account_enrichment Tool node",
);
assert.equal(
  child(playNodes, playStart)?.uuid,
  toolCall.uuid,
  "account_enrichment must be the play's first workflow node",
);

const crmNodes = playNodes.filter(
  (node) =>
    node.kind === "connector" &&
    node.connectorUuid?.resourceId === "connector:crm",
);
assert.equal(crmNodes.length, 1, "only the play may contain one CRM node");
const [crmWrite] = crmNodes;
assert.equal(
  crmWrite.actionSlug,
  "updateRecords",
  "the play's only CRM node must be updateRecords",
);
assert.equal(
  child(playNodes, toolCall)?.uuid,
  crmWrite.uuid,
  "the CRM write must immediately consume the account_enrichment result",
);

const writeProperties = new Set(
  crmWrite.config.mappings.map((mapping) => mapping.propertyName),
);
assert.equal(
  writeProperties.has("cargo_last_enriched_at"),
  true,
  "the play must write the Cargo-owned freshness timestamp",
);
assert.equal(
  writeProperties.has("cargo_enrichment_status"),
  true,
  "the play must write the Cargo-owned enrichment status",
);
assert.equal(
  writeProperties.has("last_enriched_at") ||
    writeProperties.has("enrichment_status"),
  false,
  "Cargo-owned operational properties must use the cargo_ prefix",
);

const playResource = byId.get("play:enrich_accounts");
const filterConditions = playResource.spec.filter.groups.flatMap(
  (group) => group.conditions,
);
const freshnessConditions = filterConditions.filter(
  (condition) => condition.columnSlug === "cargo_last_enriched_at",
);
assert.deepEqual(
  new Set(freshnessConditions.map((condition) => condition.operator)),
  new Set(["isNull", "lowerThan"]),
  "the play trigger must use the Cargo-owned freshness timestamp",
);
assert.equal(
  playNodes.some(
    (node) => node.kind === "connector" && node.integrationSlug === "linkedin",
  ),
  false,
  "the play must not duplicate provider connector actions",
);

assert.equal(
  byId.has("model:account_duplicate_candidates"),
  false,
  "deduplication must not deploy a duplicate-candidate staging model",
);

const dedupNodes = nodesFor("play:deduplicate_accounts");
const dedupResource = byId.get("play:deduplicate_accounts");
assert.equal(
  dedupResource.spec.modelUuid.resourceId,
  "model:crm_accounts",
  "deduplicate_accounts must run directly on the CRM account model",
);

const duplicateSearch = findOne(
  dedupNodes,
  (node) =>
    node.kind === "connector" &&
    node.connectorUuid?.resourceId === "connector:crm" &&
    node.actionSlug === "findRecords",
  "deduplicate_accounts must search the CRM with one findRecords node",
);
const duplicateScore = findOne(
  dedupNodes,
  (node) => node.kind === "native" && node.actionSlug === "scoring",
  "deduplicate_accounts must score duplicate evidence with one native Scoring node",
);
assert.deepEqual(
  duplicateScore.config.criterias.map(({ name, score }) => [name, score]),
  [
    ["Exact LinkedIn company ID", 60],
    ["Exact LinkedIn company URL", 25],
    ["Exact non-generic domain", 15],
  ],
  "the native duplicate score must preserve the approved 60/25/15 policy",
);
const manualReview = findOne(
  dedupNodes,
  (node) => node.kind === "native" && node.actionSlug === "humanReview",
  "uncertain duplicate evidence must reach one native Human review node",
);
assert.equal(
  manualReview.config.connectorUuid.resourceId,
  "connector:manual_review",
  "human review must use the declared manual-review connector",
);

const mergeNodes = dedupNodes.filter(
  (node) =>
    node.kind === "connector" &&
    node.connectorUuid?.resourceId === "connector:crm" &&
    node.actionSlug === "mergeRecords",
);
assert.equal(
  mergeNodes.length,
  2,
  "deduplicate_accounts must expose automatic and human-approved CRM merge paths",
);
const automaticMergeGate = findOne(
  dedupNodes,
  (node) => node.slug === "automatic_merge_gate",
  "deduplicate_accounts must branch on the guarded automatic-merge policy",
);
assert.match(
  automaticMergeGate.config.condition.expression,
  /duplicate_score\.score >= 60.*autoEligible === true/,
  "automatic merge must require both the score threshold and exact-ID conflict guard",
);
assert.equal(
  child(dedupNodes, automaticMergeGate)?.slug,
  "merge_automatically",
  "the guarded yes path must merge automatically",
);
assert.equal(
  dedupNodes.find(
    (node) => node.uuid === automaticMergeGate.childrenUuids[1],
  )?.uuid,
  manualReview.uuid,
  "the guarded no path must request human review",
);
assert.equal(
  dedupNodes.find((node) => node.uuid === manualReview.childrenUuids[0])?.slug,
  "merge_after_review",
  "human approval must execute the reviewed merge",
);
assert.equal(
  dedupNodes.find((node) => node.uuid === manualReview.childrenUuids[1])?.slug,
  "review_declined",
  "human decline or timeout must keep records separate",
);
assert.equal(
  child(dedupNodes, duplicateSearch)?.slug,
  "prepare_duplicate_evidence",
  "CRM candidate search must continue into deterministic evidence preparation",
);
assert.equal(
  child(dedupNodes, duplicateScore)?.slug,
  "select_survivor",
  "duplicate scoring must feed deterministic survivor selection",
);
const survivorSelection = child(dedupNodes, duplicateScore);
assert.equal(
  survivorSelection.actionSlug,
  "script",
  "survivor selection must use the checked deterministic script",
);
assert.equal(
  survivorSelection.childrenUuids[0],
  automaticMergeGate.uuid,
  "survivor selection must feed the automatic merge gate",
);
for (const mergeNode of mergeNodes) {
  assert.match(
    mergeNode.config.primaryId.expression,
    /select_survivor\.result\.primaryId/,
    "every CRM merge must use the scored cluster's selected survivor",
  );
  assert.match(
    mergeNode.config.idsToMerge.expression,
    /select_survivor\.result\.idsToMerge/,
    "every CRM merge must use the selected non-survivor IDs",
  );
}
assert.match(
  manualReview.config.content.expression,
  /Identity conflict:.*Protected ID conflict:.*Parent\/subsidiary warning:.*Evidence:/,
  "manual review must show the score, conflicts, and candidate evidence",
);

const evidenceNode = child(dedupNodes, duplicateSearch);
assert.equal(
  evidenceNode.actionSlug,
  "script",
  "duplicate evidence preparation must use the checked deterministic script",
);
const prepareEvidence = new Function("nodes", evidenceNode.config.script);
const crmRecord = (id, properties = {}) => ({
  id,
  properties: {
    linkedin_company_id: "123",
    linkedin_company_page: "https://www.linkedin.com/company/acme",
    domain: "acme.com",
    lifecyclestage: "lead",
    hs_num_open_deals: 0,
    num_associated_contacts: 0,
    hs_num_engagements: 0,
    createdate: "2024-01-01T00:00:00.000Z",
    ...properties,
  },
});
const exactEvidence = prepareEvidence({
  start: { hs_object_id: "source" },
  find_duplicate_companies: [
    crmRecord("source"),
    crmRecord("customer", { lifecyclestage: "customer" }),
  ],
});
assert.equal(exactEvidence.sourceFound, true, "the fresh source must be kept");
assert.equal(
  exactEvidence.autoEligible,
  true,
  "an exact shared LinkedIn ID without conflicts must reach the automatic gate",
);
assert.equal(
  exactEvidence.duplicateCount,
  1,
  "the evidence script must retain the duplicate candidate",
);
const selectSurvivor = new Function("nodes", survivorSelection.config.script);
const exactSurvivor = selectSurvivor({
  prepare_duplicate_evidence: { result: exactEvidence },
});
assert.equal(
  exactSurvivor.primaryId,
  "customer",
  "survivor selection must apply deterministic precedence after scoring",
);
assert.deepEqual(
  exactSurvivor.idsToMerge,
  ["source"],
  "survivor selection must return every non-survivor ID",
);

const conflictEvidence = prepareEvidence({
  start: { hs_object_id: "source" },
  find_duplicate_companies: [
    crmRecord("source"),
    crmRecord("conflict", { domain: "other.example" }),
  ],
});
assert.equal(
  conflictEvidence.identityConflict,
  true,
  "conflicting non-null identity must be visible to the merge gate",
);
assert.equal(
  conflictEvidence.autoEligible,
  false,
  "an identity conflict must require human review",
);

const genericDomainEvidence = prepareEvidence({
  start: { hs_object_id: "source" },
  find_duplicate_companies: [
    crmRecord("source", {
      linkedin_company_id: "",
      linkedin_company_page: "",
      domain: "google.com",
    }),
    crmRecord("other", {
      linkedin_company_id: "",
      linkedin_company_page: "",
      domain: "google.com",
    }),
  ],
});
assert.equal(
  genericDomainEvidence.duplicateCount,
  0,
  "a generic domain alone must never create a duplicate candidate",
);

const staleSourceEvidence = prepareEvidence({
  start: { hs_object_id: "already-merged" },
  find_duplicate_companies: [crmRecord("survivor")],
});
assert.equal(
  staleSourceEvidence.sourceFound,
  false,
  "an already-merged or changed source must stop before scoring",
);
assert.deepEqual(
  staleSourceEvidence.cluster,
  [],
  "a missing fresh source must never emit a mergeable cluster",
);

assert.equal(dedupResource.spec.isEnabled, false, "dedup play must be disabled");
assert.equal(dedupResource.spec.limit, 15, "dedup pilot must be limited to 15");
assert.equal(
  dedupResource.spec.runCreationRule,
  "noConcurrency",
  "dedup play must use noConcurrency",
);

const candidate = (id, overrides = {}) => ({
  id,
  linkedinId: "123",
  linkedinUrl: "https://www.linkedin.com/company/acme",
  domain: "https://www.acme.com/",
  isCustomer: false,
  openOpportunities: 0,
  contacts: 0,
  activities: 0,
  populatedProperties: 1,
  createdAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});
const classified = infra.classifyCluster([
  candidate("older"),
  candidate("customer", { isCustomer: true }),
]);
assert.equal(
  classified.matchClass,
  "exact_unique_linkedin",
  "an exact shared LinkedIn company ID must be classified deterministically",
);
assert.equal(
  classified.survivor.id,
  "customer",
  "the survivor policy must prefer a customer record",
);
assert.equal(
  infra.normalizeDomain("https://www.Acme.com/path"),
  "acme.com",
  "domain normalization must be stable",
);
assert.equal(
  infra.normalizeLinkedInHandle("linkedin.com/company/Acme/?trk=public"),
  "acme",
  "LinkedIn handles must normalize with or without a URL scheme",
);
assert.equal(
  infra.classifyCluster([
    candidate("one", { linkedinId: undefined }),
    candidate("two", { linkedinId: undefined }),
  ]).matchClass,
  "linkedin_url_review",
  "a shared LinkedIn URL without an exact ID must stay review-only",
);
assert.equal(
  infra.classifyCluster([
    candidate("one", { linkedinId: "123" }),
    candidate("two", { linkedinId: "456" }),
  ]).matchClass,
  "conflict",
  "conflicting LinkedIn company IDs must never merge automatically",
);
assert.throws(
  () => infra.classifyCluster([candidate("same"), candidate("same")]),
  /distinct source record IDs/,
  "duplicate source record IDs must be rejected",
);

console.log(
  "ok: enrichment keeps its tool/play boundary; deduplication searches and scores CRM rows before guarded merge or human review",
);
