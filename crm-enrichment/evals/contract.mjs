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


// --------------------------------------------------------------------------
// People path: the contact tool is identifier-gated with a resolver-tool
// fallback and no CRM access; the champion verdict is one AI tool node; both
// contact plays call the tools first, own every CRM write with the verified
// Slack payload, pair isNull with isEmpty on every blank test, and split the
// book on the related account's customer status.
// --------------------------------------------------------------------------

// A literal `true` in a workflow body compiles to a template expression.
const isLiteralTrue = (value) =>
  value === true || value?.expression === "{{ true }}";

const contactToolNodes = nodesFor("tool:contact_enrichment");
const contactToolStart = findOne(
  contactToolNodes,
  (node) => node.kind === "native" && node.actionSlug === "start",
  "contact_enrichment must have one start node",
);
const contactIdentifierGate = child(contactToolNodes, contactToolStart);
assert.equal(
  contactIdentifierGate?.actionSlug,
  "branch",
  "the contact tool's first node must branch on identifier availability",
);
assert.match(
  contactIdentifierGate.config.condition.expression,
  /linkedinUrl/,
  "the contact identifier gate must inspect the LinkedIn URL input",
);
assert.match(
  contactIdentifierGate.config.condition.expression,
  /email/,
  "the contact identifier gate must inspect the email input",
);

const contactRoutes = children(contactToolNodes, contactIdentifierGate);
findOne(
  contactRoutes,
  (node) => node?.kind === "native" && node.actionSlug === "end",
  "the contact identifier gate must end without a provider call when both identifiers are absent",
);
const contactRouteBranch = findOne(
  contactRoutes,
  (node) => node?.kind === "native" && node.actionSlug === "branch",
  "the contact identifier gate must continue to one route-selection Branch",
);
const contactRouteChildren = children(contactToolNodes, contactRouteBranch);
findOne(
  contactRouteChildren,
  (node) =>
    node?.kind === "connector" &&
    node.integrationSlug === "linkedin" &&
    node.actionSlug === "enrichProfile",
  "a row with a LinkedIn URL must route straight to the person enrichment",
);
const resolverNode = findOne(
  contactRouteChildren,
  (node) => node?.kind === "tool",
  "a row without a LinkedIn URL must route to the resolver tool instead",
);
assert.equal(
  typeof resolverNode.toolUuid,
  "string",
  "the resolver is the workspace's Find-LinkedIn-URL-from-email template tool, referenced by uuid",
);
const resolverGate = child(contactToolNodes, resolverNode);
assert.equal(
  resolverGate?.actionSlug,
  "branch",
  "the resolver must be followed by a Branch on its resolved URL",
);
const resolverOutcomes = children(contactToolNodes, resolverGate);
findOne(
  resolverOutcomes,
  (node) => node?.kind === "native" && node.actionSlug === "end",
  "an unresolved email must end without a person-enrichment call",
);
findOne(
  resolverOutcomes,
  (node) =>
    node?.kind === "connector" &&
    node.integrationSlug === "linkedin" &&
    node.actionSlug === "enrichProfile",
  "a resolved email must continue into the person enrichment",
);
assert.deepEqual(
  new Set(
    contactToolNodes
      .filter((node) => node.kind === "connector")
      .map((node) => `${node.integrationSlug}.${node.actionSlug}`),
  ),
  new Set(["linkedin.enrichProfile"]),
  "the contact tool's only connector action is the person enrichment",
);
assert.equal(
  contactToolNodes.some(
    (node) =>
      node.kind === "connector" &&
      node.connectorUuid?.resourceId === "connector:crm",
  ),
  false,
  "contact_enrichment must not contain CRM connector nodes",
);
assert.equal(
  contactToolNodes.some(
    (node) => node.kind === "native" && node.actionSlug === "filter",
  ),
  false,
  "the contact tool must express its gates as code-generated Branch nodes",
);

// The verdict tool is one AI step with no connector access: the prompt is
// evaluated exactly once per row, at its end node.
const verdictNodes = nodesFor("tool:champion_verdict");
assert.equal(
  verdictNodes.some((node) => node.kind === "connector"),
  false,
  "champion_verdict must not contain connector nodes",
);
const verdictEnd = findOne(
  verdictNodes,
  (node) => node.kind === "native" && node.actionSlug === "end",
  "champion_verdict must have one end node",
);
const verdictVariable = verdictEnd.config.variables.find(
  (variable) => variable.name === "verdict",
);
assert.equal(
  verdictVariable?.value?.instructTo,
  "ai",
  "the verdict must be an AI-instructed expression materialized at the tool's end node",
);

// The relationship is how both contact filters read the account's customer
// status.
const relationship = byId.get("relationship:contact_primary_company");
assert.ok(relationship, "the contact_primary_company relationship must exist");
assert.equal(
  relationship.spec.fromColumnSlug,
  "hs_object_id",
  "the relationship must start from the account's CRM record id",
);
assert.equal(
  relationship.spec.toColumnSlug,
  "associatedcompanyid",
  "the relationship must end on the contact's primary company link",
);

// Blank HubSpot values surface as NULL in the extract: isEmpty alone matches
// nothing, so every isEmpty condition needs an isNull sibling on the same
// column in the same group.
const assertNullSafeBlanks = (playId) => {
  for (const group of byId.get(playId).spec.filter.groups) {
    for (const condition of group.conditions) {
      if (condition.operator !== "isEmpty") continue;
      assert.equal(
        group.conditions.some(
          (sibling) =>
            sibling.operator === "isNull" &&
            sibling.columnSlug === condition.columnSlug,
        ),
        true,
        `${playId}: the isEmpty test on ${condition.columnSlug} must be paired with isNull`,
      );
    }
  }
};

const assertContactPlay = (playId, expectations) => {
  const playNodes = nodesFor(playId);
  const start = findOne(
    playNodes,
    (node) => node.kind === "native" && node.actionSlug === "start",
    `${playId} must have one start node`,
  );
  const tool = findOne(
    playNodes,
    (node) =>
      node.kind === "tool" &&
      node.toolUuid?.resourceId === "tool:contact_enrichment",
    `${playId} must contain exactly one contact_enrichment Tool node`,
  );
  assert.equal(
    child(playNodes, start)?.uuid,
    tool.uuid,
    `contact_enrichment must be ${playId}'s first workflow node`,
  );
  assert.equal(
    playNodes.some(
      (node) => node.kind === "connector" && node.integrationSlug === "linkedin",
    ),
    false,
    `${playId} must not duplicate provider connector actions`,
  );

  const writes = playNodes.filter(
    (node) =>
      node.kind === "connector" &&
      node.connectorUuid?.resourceId === "connector:crm" &&
      node.actionSlug === "updateRecords",
  );
  assert.equal(
    writes.length,
    expectations.writeCount,
    `${playId} must contain exactly ${expectations.writeCount} CRM update(s)`,
  );
  for (const write of writes) {
    assert.equal(
      write.config.objectType,
      "contacts",
      `${playId} must write to the contacts object`,
    );
    assert.equal(
      write.config.matchingPropertyName,
      "hs_object_id",
      `${playId} must match the CRM record id on every write`,
    );
    const properties = new Set(
      write.config.mappings.map((mapping) => mapping.propertyName),
    );
    assert.equal(
      properties.has("cargo_last_enriched_at") &&
        properties.has("cargo_enrichment_status"),
      true,
      `every ${playId} write must stamp the Cargo-owned freshness fields`,
    );
    assert.equal(
      properties.has("last_enriched_at") || properties.has("enrichment_status"),
      false,
      "Cargo-owned operational properties must use the cargo_ prefix",
    );
  }

  const filterConditions = byId
    .get(playId)
    .spec.filter.groups.flatMap((group) => group.conditions);
  const freshness = filterConditions.filter(
    (condition) => condition.columnSlug === "cargo_last_enriched_at",
  );
  assert.deepEqual(
    new Set(freshness.map((condition) => condition.operator)),
    new Set(["isNull", "lowerThan"]),
    `${playId} must trigger on the Cargo-owned freshness timestamp`,
  );
  assert.equal(
    freshness.find((condition) => condition.operator === "lowerThan").value,
    expectations.freshnessWindow,
    `${playId} must refresh on the ${expectations.freshnessWindow} cadence`,
  );
  const customerConditions = filterConditions.filter(
    (condition) => condition.columnSlug === "lifecyclestage",
  );
  assert.equal(
    customerConditions.length > 0 &&
      customerConditions.every((condition) => condition.relatedModelUuid),
    true,
    `${playId} must read the customer status from the RELATED account, never the contact's own lifecycle`,
  );
  assert.equal(
    customerConditions.some(
      (condition) => condition.operator === expectations.customerOperator,
    ),
    true,
    `${playId} must sit on the ${expectations.customerOperator}-customer side of the split`,
  );
  assertNullSafeBlanks(playId);
  return playNodes;
};

const enrichContactsNodes = assertContactPlay("play:enrich_contacts", {
  writeCount: 1,
  freshnessWindow: "6 months",
  customerOperator: "isNot",
});
const [contactWrite] = enrichContactsNodes.filter(
  (node) => node.kind === "connector" && node.actionSlug === "updateRecords",
);
for (const property of [
  "linkedin_person_id",
  "linkedin_profile_url",
  "jobtitle",
]) {
  const mapping = contactWrite.config.mappings.find(
    (candidate) => candidate.propertyName === property,
  );
  assert.equal(
    isLiteralTrue(mapping?.skipIfExist),
    true,
    `enrich_contacts must fill ${property} blanks without overwriting`,
  );
}
assert.equal(
  enrichContactsNodes.some(
    (node) =>
      node.kind === "tool" &&
      node.toolUuid?.resourceId === "tool:champion_verdict",
  ),
  false,
  "the standard enrichment play must not run the champion verdict",
);
assert.equal(
  enrichContactsNodes.some(
    (node) => node.kind === "connector" && node.integrationSlug === "slack",
  ),
  false,
  "the standard enrichment play must not send champion alerts",
);

const championNodes = assertContactPlay("play:monitor_champions", {
  writeCount: 4,
  freshnessWindow: "30 days",
  customerOperator: "is",
});

// The verdict tool runs once, and only when the deterministic guards could
// not confirm the company: its parent must be a Branch, not the start.
const verdictCall = findOne(
  championNodes,
  (node) =>
    node.kind === "tool" &&
    node.toolUuid?.resourceId === "tool:champion_verdict",
  "monitor_champions must contain exactly one champion_verdict Tool node",
);
const verdictParent = championNodes.find((node) =>
  (node.childrenUuids ?? []).includes(verdictCall.uuid),
);
assert.equal(
  verdictParent?.actionSlug,
  "branch",
  "the champion verdict must be gated behind the deterministic same-company Branch",
);
for (const node of championNodes.filter((n) => n.actionSlug === "branch")) {
  assert.doesNotMatch(
    node.config.condition.expression,
    /PRIMARY employment/,
    "no branch condition may inline the verdict prompt: branch on the verdict tool's output",
  );
}

const championWrites = championNodes.filter(
  (node) => node.kind === "connector" && node.actionSlug === "updateRecords",
);
const moveWrites = championWrites.filter((write) =>
  write.config.mappings.some(
    (mapping) => mapping.propertyName === "associatedcompanyid",
  ),
);
assert.equal(
  moveWrites.length,
  1,
  "exactly one champion write may move the primary company association",
);
assert.equal(
  isLiteralTrue(
    moveWrites[0].config.mappings.find(
      (mapping) => mapping.propertyName === "jobtitle",
    )?.skipIfExist,
  ),
  false,
  "the job-change write must refresh the stale title, not preserve it",
);
const employmentValues = new Set(
  championWrites.flatMap((write) =>
    write.config.mappings
      .filter(
        (mapping) => mapping.propertyName === "primary_employment_status",
      )
      .map((mapping) => mapping.value),
  ),
);
assert.deepEqual(
  employmentValues,
  new Set(["Active", "Left"]),
  "the champion play must record Active and Left employment outcomes",
);
assert.equal(
  championWrites.some((write) =>
    write.config.mappings.some(
      (mapping) =>
        mapping.propertyName === "cargo_enrichment_status" &&
        mapping.value === "partial",
    ),
  ),
  true,
  "a move the play cannot finish must stamp a partial outcome",
);

// Find-or-create: the new company is searched by LinkedIn company identity
// and domain, and created only behind a Branch when neither matched.
const championReads = championNodes.filter(
  (node) => node.kind === "connector" && node.actionSlug === "findRecords",
);
assert.equal(
  championReads.some((node) =>
    node.config.criterias.some(
      (criteria) => criteria.propertyName === "linkedin_company_page",
    ),
  ),
  true,
  "the champion play must search the new company by LinkedIn company identity",
);
assert.equal(
  championReads.some(
    (node) =>
      node.config.objectType === "contacts" &&
      node.config.criterias.some(
        (criteria) => criteria.propertyName === "linkedin_person_id",
      ),
  ),
  true,
  "the champion play must look for an existing contact before updating",
);
const companyCreate = findOne(
  championNodes,
  (node) =>
    node.kind === "connector" &&
    node.actionSlug === "insertRecord" &&
    node.config.objectType === "companies",
  "the champion play must create the new company when no match exists",
);
const createParent = championNodes.find((node) =>
  (node.childrenUuids ?? []).includes(companyCreate.uuid),
);
assert.equal(
  createParent?.actionSlug,
  "branch",
  "company creation must be gated behind the no-match Branch, never unconditional",
);

// One JOB CHANGE note, associated to the contact, the former company, and
// the new company; the former relationship is preserved explicitly.
findOne(
  championNodes,
  (node) =>
    node.kind === "connector" &&
    node.actionSlug === "insertRecord" &&
    node.config.objectType === "notes",
  "the champion play must write one JOB CHANGE note",
);
const associations = championNodes.filter(
  (node) => node.kind === "connector" && node.actionSlug === "createAssociation",
);
assert.equal(
  associations.filter((node) => node.config.fromObjectType === "notes").length,
  3,
  "the note must be associated to the contact, the former company, and the new company",
);
assert.equal(
  associations.some(
    (node) =>
      node.config.fromObjectType === "contacts" &&
      node.config.toObjectType === "companies",
  ),
  true,
  "the former company relationship must be preserved with an explicit association",
);

// The verified Slack payload: channelId + format + body, never message.
const championAlerts = championNodes.filter(
  (node) =>
    node.kind === "connector" &&
    node.integrationSlug === "slack" &&
    node.actionSlug === "postMessage",
);
assert.equal(
  championAlerts.length,
  2,
  "both unfinished-move outcomes must alert the former customer account's owner",
);
for (const alert of championAlerts) {
  assert.equal(
    "channelId" in alert.config &&
      alert.config.format === "markdown" &&
      "body" in alert.config,
    true,
    "champion alerts must use the live postMessage payload: channelId, format: markdown, body",
  );
  assert.equal(
    "message" in alert.config,
    false,
    "the postMessage schema has no message field: its runs die at the alert step",
  );
}
assert.equal(
  nodesFor("play:enrich_accounts").some(
    (node) => node.kind === "connector" && node.integrationSlug === "slack",
  ) ||
    toolNodes.some(
      (node) => node.kind === "connector" && node.integrationSlug === "slack",
    ),
  false,
  "champion alerts belong to monitor_champions only",
);

console.log(
  "ok: account_enrichment is a Branch-gated provider tool; enrich_accounts calls it before the only CRM write",
);
console.log(
  "ok: contact_enrichment resolves and enriches without CRM access; champion_verdict is one gated AI node; enrich_contacts and monitor_champions own null-safe filters, the relationship-based customer split, find-or-create, and the verified Slack payload",
);
