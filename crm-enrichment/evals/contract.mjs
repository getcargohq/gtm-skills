import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
await import(`../infra/index.ts?contract=${Date.now()}`);

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

const children = (nodes, node) =>
  node.childrenUuids.map((uuid) =>
    nodes.find((candidate) => candidate.uuid === uuid),
  );

const toolNodes = nodesFor("tool:account_enrichment");
const toolStart = findOne(
  toolNodes,
  (node) => node.kind === "native" && node.actionSlug === "start",
  "account_enrichment must have one start node",
);
const identifierGate = child(toolNodes, toolStart);
assert.equal(
  identifierGate?.kind,
  "native",
  "the tool's first node must be native",
);
assert.equal(
  identifierGate?.actionSlug,
  "branch",
  "the tool's first node must branch on identifier availability",
);
assert.match(
  identifierGate.config.condition.expression,
  /linkedinUrlOrHandle/,
  "the identifier gate must inspect the LinkedIn input",
);
assert.match(
  identifierGate.config.condition.expression,
  /domain/,
  "the identifier gate must inspect the domain input",
);

const identifierRoutes = children(toolNodes, identifierGate);
const providerBranch = findOne(
  identifierRoutes,
  (node) => node?.kind === "native" && node.actionSlug === "branch",
  "the identifier gate must continue to one provider-routing Branch",
);
findOne(
  identifierRoutes,
  (node) => node?.kind === "native" && node.actionSlug === "end",
  "the identifier gate must end without a provider call when both identifiers are absent",
);
assert.equal(
  toolNodes.some(
    (node) => node.kind === "native" && node.actionSlug === "filter",
  ),
  false,
  "the defineWorkflow tool must express its gates as code-generated Branch nodes",
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

console.log(
  "ok: account_enrichment is a Branch-gated provider tool; enrich_accounts calls it before the only CRM write",
);
