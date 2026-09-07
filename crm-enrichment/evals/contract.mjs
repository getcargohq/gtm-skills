// The enrichment graph's executable contract: the boundaries CDK schema
// validation cannot express, checked against the compiled resources.
//
// It loads through `loadResources`, the same loader `cargo-ai cdk check`,
// `plan`, and `deploy` use, so what is asserted here is what would deploy.
import assert from "node:assert/strict";
import { loadResources } from "@cargo-ai/cdk";

const infraDir = new URL("../infra", import.meta.url).pathname;
const byId = new Map(
  (await loadResources(infraDir)).map((resource) => [resource.id, resource]),
);

const nodesFor = (id) => {
  const resource = byId.get(id);
  assert.ok(resource, `${id} must exist`);
  assert.ok(Array.isArray(resource.spec.nodes), `${id} must have nodes`);
  return resource.spec.nodes;
};
const onlyIn = (nodes, predicate, message) => {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, message);
  return matches[0];
};
const childrenOf = (nodes, node) =>
  node.childrenUuids.map((uuid) =>
    nodes.find((candidate) => candidate.uuid === uuid),
  );

// The tool: identifier in, company data out, no CRM anywhere.
const toolNodes = nodesFor("tool:account_enrichment");
const toolStart = onlyIn(
  toolNodes,
  (node) => node.kind === "native" && node.actionSlug === "start",
  "account_enrichment must have one start node",
);
const identifierGate = childrenOf(toolNodes, toolStart)[0];
assert.equal(
  identifierGate.actionSlug,
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

const identifierRoutes = childrenOf(toolNodes, identifierGate);
const providerGate = onlyIn(
  identifierRoutes,
  (node) => node?.kind === "native" && node.actionSlug === "branch",
  "the identifier gate must continue to one provider-routing Branch",
);
onlyIn(
  identifierRoutes,
  (node) => node?.kind === "native" && node.actionSlug === "end",
  "the identifier gate must end without a provider call when both identifiers are absent",
);
assert.equal(
  toolNodes.some(
    (node) => node.kind === "native" && node.actionSlug === "filter",
  ),
  false,
  "the tool must express its gates as code-generated Branch nodes",
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
  new Set(providerGate.childrenUuids),
  new Set(providerNodes.map((node) => node.uuid)),
  "the provider actions must be mutually exclusive Branch children — at most one paid call per row",
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

// The play: call the tool, then own the only CRM write.
const playNodes = nodesFor("play:enrich_accounts");
const playStart = onlyIn(
  playNodes,
  (node) => node.kind === "native" && node.actionSlug === "start",
  "enrich_accounts must have one start node",
);
const toolCall = onlyIn(
  playNodes,
  (node) =>
    node.kind === "tool" &&
    node.toolUuid?.resourceId === "tool:account_enrichment",
  "enrich_accounts must contain exactly one account_enrichment Tool node",
);
assert.equal(
  childrenOf(playNodes, playStart)[0].uuid,
  toolCall.uuid,
  "account_enrichment must be the play's first workflow node",
);
assert.equal(
  playNodes.some(
    (node) => node.kind === "connector" && node.integrationSlug === "linkedin",
  ),
  false,
  "the play must not duplicate the provider actions the tool owns",
);

const crmWrite = onlyIn(
  playNodes,
  (node) =>
    node.kind === "connector" &&
    node.connectorUuid?.resourceId === "connector:crm",
  "only the play may contain a CRM node, and only one",
);
assert.equal(
  crmWrite.actionSlug,
  "updateRecords",
  "the play's only CRM node must be updateRecords",
);
assert.equal(
  childrenOf(playNodes, toolCall)[0].uuid,
  crmWrite.uuid,
  "the CRM write must immediately consume the account_enrichment result",
);

const written = new Set(
  crmWrite.config.mappings.map((mapping) => mapping.propertyName),
);
assert.equal(
  written.has("cargo_last_enriched_at"),
  true,
  "the play must write the Cargo-owned freshness timestamp",
);
assert.equal(
  written.has("cargo_enrichment_status"),
  true,
  "the play must write the Cargo-owned enrichment status",
);
assert.equal(
  written.has("last_enriched_at") || written.has("enrichment_status"),
  false,
  "Cargo-owned operational properties must use the cargo_ prefix",
);

// Eligibility and freshness belong to the trigger, not the workflow.
const conditions = byId
  .get("play:enrich_accounts")
  .spec.filter.groups.flatMap((group) => group.conditions);
assert.deepEqual(
  new Set(
    conditions
      .filter((condition) => condition.columnSlug === "cargo_last_enriched_at")
      .map((condition) => condition.operator),
  ),
  new Set(["isNull", "lowerThan"]),
  "the play trigger must gate on the Cargo-owned freshness timestamp",
);

console.log(
  "ok: account_enrichment is a Branch-gated provider tool; enrich_accounts calls it before the only CRM write",
);
