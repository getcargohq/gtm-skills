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

const candidateModel = byId.get("model:account_duplicate_candidates");
assert.ok(candidateModel, "account_duplicate_candidates must exist");
assert.equal(
  candidateModel.spec.datasetUuid,
  "native",
  "duplicate candidates must use one native review model",
);
assert.deepEqual(
  new Set(candidateModel.spec.config.columns.map((column) => column.slug)),
  new Set([
    "audit_run_id",
    "cluster_id",
    "source_model_slug",
    "ordered_record_ids",
    "survivor_id",
    "match_class",
    "normalized_linkedin_id",
    "identity_conflict",
    "protected_id_conflict",
    "stale",
  ]),
  "the candidate model must carry the complete proposal evidence",
);

const dedupNodes = nodesFor("play:deduplicate_accounts");
assert.equal(
  dedupNodes.some(
    (node) =>
      node.kind === "connector" || node.kind === "tool" || node.kind === "agent",
  ),
  false,
  "deduplicate_accounts must be a deterministic proposal workflow",
);
assert.equal(
  dedupNodes.some((node) => /merge/i.test(node.actionSlug ?? "")),
  false,
  "deduplicate_accounts must contain no merge action",
);
const proposalEnds = dedupNodes.filter(
  (node) => node.kind === "native" && node.actionSlug === "end",
);
assert.ok(proposalEnds.length > 0, "deduplicate_accounts must emit proposals");
for (const end of proposalEnds) {
  const approval = end.config.variables.find(
    (variable) => variable.name === "approvedForMerge",
  );
  const auditRun = end.config.variables.find(
    (variable) => variable.name === "auditRunId",
  );
  assert.equal(
    approval?.value?.expression,
    "{{ false }}",
    "every shipped deduplication outcome must keep approvedForMerge false",
  );
  assert.equal(
    auditRun?.value?.expression,
    "{{ nodes.start.audit_run_id }}",
    "every proposal must preserve the approved audit run ID",
  );
}

const dedupResource = byId.get("play:deduplicate_accounts");
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
  "conflicting LinkedIn company IDs must never become proposals",
);
assert.throws(
  () => infra.classifyCluster([candidate("same"), candidate("same")]),
  /distinct source record IDs/,
  "duplicate source record IDs must be rejected",
);

console.log(
  "ok: enrichment keeps its tool/play boundary; deduplication emits deterministic proposal-only clusters",
);
