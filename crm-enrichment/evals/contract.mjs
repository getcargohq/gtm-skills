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

const isLiteralTrue = (value) =>
  value === true || value?.expression === "{{ true }}";

// Account path: the tool owns provider routing and the play owns the CRM write.
const accountToolNodes = nodesFor("tool:account_enrichment");
const accountToolStart = findOne(
  accountToolNodes,
  (node) => node.kind === "native" && node.actionSlug === "start",
  "account_enrichment must have one start node",
);
const accountIdentifierGate = child(accountToolNodes, accountToolStart);
assert.equal(accountIdentifierGate?.actionSlug, "branch");
assert.match(accountIdentifierGate.config.condition.expression, /linkedinUrlOrHandle/);
assert.match(accountIdentifierGate.config.condition.expression, /domain/);

const accountProviderNodes = accountToolNodes.filter(
  (node) => node.kind === "connector" && node.integrationSlug === "linkedin",
);
assert.deepEqual(
  new Set(accountProviderNodes.map((node) => node.actionSlug)),
  new Set(["enrichCompany", "enrichCompanyFromDomain"]),
  "account_enrichment must keep the LinkedIn-first and domain-fallback routes",
);
assert.equal(
  accountToolNodes.some(
    (node) => node.connectorUuid?.resourceId === "connector:crm",
  ),
  false,
  "account_enrichment must not access the CRM",
);

const accountPlay = byId.get("play:enrich_accounts");
assert.ok(accountPlay, "play:enrich_accounts must exist");
assert.equal(accountPlay.spec.isEnabled, false);
assert.equal(accountPlay.spec.runCreationRule, "noConcurrency");
const accountPlayNodes = nodesFor("play:enrich_accounts");
const accountToolCall = findOne(
  accountPlayNodes,
  (node) =>
    node.kind === "tool" &&
    node.toolUuid?.resourceId === "tool:account_enrichment",
  "enrich_accounts must call account_enrichment once",
);
const accountWrites = accountPlayNodes.filter(
  (node) =>
    node.kind === "connector" &&
    node.connectorUuid?.resourceId === "connector:crm" &&
    node.actionSlug === "updateRecords",
);
assert.equal(accountWrites.length, 1, "enrich_accounts must own one CRM write");
assert.equal(
  child(accountPlayNodes, accountToolCall)?.uuid,
  accountWrites[0].uuid,
  "the account CRM write must consume the tool output",
);

// Contact custom tool: one guarded LinkedIn provider action and no CRM access.
const contactToolNodes = nodesFor("tool:contact_linkedin_enrichment");
const contactToolStart = findOne(
  contactToolNodes,
  (node) => node.kind === "native" && node.actionSlug === "start",
  "contact_linkedin_enrichment must have one start node",
);
const contactIdentifierGate = child(contactToolNodes, contactToolStart);
assert.equal(
  contactIdentifierGate?.actionSlug,
  "branch",
  "contact_linkedin_enrichment must gate the provider call on a LinkedIn URL",
);
assert.match(contactIdentifierGate.config.condition.expression, /linkedinUrl/);
const contactProviderNodes = contactToolNodes.filter(
  (node) => node.kind === "connector",
);
assert.equal(
  contactProviderNodes.length,
  1,
  "contact_linkedin_enrichment must contain one connector action",
);
assert.equal(contactProviderNodes[0].integrationSlug, "linkedin");
assert.equal(contactProviderNodes[0].actionSlug, "enrichProfile");
assert.equal(
  contactToolNodes.some(
    (node) => node.connectorUuid?.resourceId === "connector:crm",
  ),
  false,
  "contact_linkedin_enrichment must not access the CRM",
);

// Contact play: one play, exactly three tool types, and branch-gated routes.
const contactPlay = byId.get("play:enrich_contacts");
assert.ok(contactPlay, "play:enrich_contacts must exist");
assert.equal(contactPlay.spec.isEnabled, false, "enrich_contacts must be disabled");
assert.equal(
  contactPlay.spec.runCreationRule,
  "noConcurrency",
  "enrich_contacts must prevent overlapping runs",
);

const contactNodes = nodesFor("play:enrich_contacts");
const contactStart = findOne(
  contactNodes,
  (node) => node.kind === "native" && node.actionSlug === "start",
  "enrich_contacts must have one start node",
);
const routeByLinkedin = child(contactNodes, contactStart);
assert.equal(
  routeByLinkedin?.actionSlug,
  "branch",
  "enrich_contacts must first branch on LinkedIn availability",
);
assert.match(routeByLinkedin.config.condition.expression, /linkedin_profile_url/);

const findEmailNode = findOne(
  contactNodes,
  (node) =>
    node.kind === "tool" &&
    node.toolUuid === "REPLACE-WITH-FIND-EMAIL-TOOL-UUID",
  "enrich_contacts must call Cargo-native Find Email once",
);
const findLinkedinNode = findOne(
  contactNodes,
  (node) =>
    node.kind === "tool" &&
    node.toolUuid ===
      "REPLACE-WITH-FIND-LINKEDIN-PROFILE-FROM-EMAIL-TOOL-UUID",
  "enrich_contacts must call Cargo-native Find LinkedIn Profile from Email once",
);
const customToolCalls = contactNodes.filter(
  (node) =>
    node.kind === "tool" &&
    node.toolUuid?.resourceId === "tool:contact_linkedin_enrichment",
);
assert.equal(
  customToolCalls.length,
  3,
  "each mutually exclusive successful route must call custom contact enrichment",
);

const toolTargets = new Set(
  contactNodes
    .filter((node) => node.kind === "tool")
    .map((node) =>
      typeof node.toolUuid === "string"
        ? node.toolUuid
        : node.toolUuid?.resourceId,
    ),
);
assert.deepEqual(
  toolTargets,
  new Set([
    "REPLACE-WITH-FIND-EMAIL-TOOL-UUID",
    "REPLACE-WITH-FIND-LINKEDIN-PROFILE-FROM-EMAIL-TOOL-UUID",
    "tool:contact_linkedin_enrichment",
  ]),
  "enrich_contacts must use only the two Cargo-native resolvers and the custom LinkedIn enrichment tool",
);

const parentOf = (node) =>
  contactNodes.find((candidate) => candidate.childrenUuids.includes(node.uuid));
assert.equal(parentOf(findEmailNode)?.actionSlug, "branch", "Find Email must be gated");
assert.match(parentOf(findEmailNode).config.condition.expression, /email/);
assert.equal(
  parentOf(findLinkedinNode)?.actionSlug,
  "branch",
  "Find LinkedIn Profile from Email must be gated",
);
assert.match(parentOf(findLinkedinNode).config.condition.expression, /email/);

const resolvedLinkedinGate = child(contactNodes, findLinkedinNode);
assert.equal(
  resolvedLinkedinGate?.actionSlug,
  "branch",
  "the LinkedIn resolver must be followed by a result gate",
);
assert.match(resolvedLinkedinGate.config.condition.expression, /linkedin_url/);
const resolvedLinkedinOutcomes = children(contactNodes, resolvedLinkedinGate);
findOne(
  resolvedLinkedinOutcomes,
  (node) => node?.kind === "native" && node.actionSlug === "end",
  "an unresolved email must end without enrichment or a CRM write",
);
findOne(
  resolvedLinkedinOutcomes,
  (node) =>
    node?.kind === "tool" &&
    node.toolUuid?.resourceId === "tool:contact_linkedin_enrichment",
  "a resolved LinkedIn URL must continue to custom enrichment",
);

assert.equal(
  contactNodes.some(
    (node) => node.kind === "connector" && node.integrationSlug === "linkedin",
  ),
  false,
  "the play must call LinkedIn only through tools",
);
const contactWrites = contactNodes.filter(
  (node) =>
    node.kind === "connector" &&
    node.connectorUuid?.resourceId === "connector:crm" &&
    node.actionSlug === "updateRecords",
);
assert.equal(
  contactWrites.length,
  3,
  "each mutually exclusive successful route must end in one CRM write",
);
for (const write of contactWrites) {
  assert.equal(write.config.objectType, "contacts");
  assert.equal(write.config.matchingPropertyName, "hs_object_id");
  assert.equal(
    parentOf(write)?.toolUuid?.resourceId,
    "tool:contact_linkedin_enrichment",
    "every CRM write must immediately consume custom enrichment output",
  );
  const mappings = new Map(
    write.config.mappings.map((mapping) => [mapping.propertyName, mapping]),
  );
  for (const property of [
    "email",
    "linkedin_person_id",
    "linkedin_profile_url",
    "jobtitle",
  ]) {
    assert.equal(
      isLiteralTrue(mappings.get(property)?.skipIfExist),
      true,
      `${property} must be filled only when blank`,
    );
  }
  for (const property of [
    "cargo_last_enriched_at",
    "cargo_enrichment_status",
  ]) {
    assert.equal(
      mappings.has(property),
      true,
      `a successful contact write must stamp ${property}`,
    );
  }
}

const contactGroups = contactPlay.spec.filter.groups;
const contactConditions = contactGroups.flatMap((group) => group.conditions);
const contactFreshness = contactConditions.filter(
  (condition) => condition.columnSlug === "cargo_last_enriched_at",
);
assert.deepEqual(
  new Set(contactFreshness.map((condition) => condition.operator)),
  new Set(["isNull", "lowerThan"]),
  "enrich_contacts must use null-or-stale freshness",
);
assert.equal(
  contactFreshness.find((condition) => condition.operator === "lowerThan")
    ?.value,
  "6 months",
);
for (const group of contactGroups.filter((candidate) =>
  candidate.conditions.some((condition) => condition.operator === "isEmpty"),
)) {
  for (const condition of group.conditions.filter(
    (candidate) => candidate.operator === "isEmpty",
  )) {
    assert.equal(
      group.conditions.some(
        (candidate) =>
          candidate.columnSlug === condition.columnSlug &&
          candidate.operator === "isNull",
      ),
      true,
      `enrich_contacts must pair isEmpty with isNull for ${condition.columnSlug}`,
    );
  }
}

console.log(
  "ok: account enrichment keeps provider routing in the tool and the CRM write in the play",
);
console.log(
  "ok: enrich_contacts gates two Cargo-native resolvers and one custom LinkedIn enrichment tool before play-owned writes",
);
