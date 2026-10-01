import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

// The invariants under "What should not change", checked against the compiled
// graph rather than the source, so they hold for any CRM the play is adapted
// to. Run after every adaptation:
//   node --import tsx evals/contract.mjs

resetRegistry();
await import(`../infra/plays/route-new-hires.ts?contract=${Date.now()}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

// The source: a Sales Navigator job-change search, capped per URL.
const model = byId.get("model:new_hires");
assert.ok(model, "model:new_hires must exist");
assert.equal(model.spec.extractorSlug, "fetchLeadSearch");
const urls = [model.spec.config.urls].flat();
assert.ok(urls.length > 0, "the model must carry at least one search URL");
for (const url of urls) {
  for (const filter of [
    "RECENTLY_CHANGED_JOBS",
    "YEARS_AT_CURRENT_COMPANY",
    "YEARS_IN_CURRENT_POSITION",
  ]) {
    assert.ok(
      url.includes(`type:${filter}`),
      `every search URL must keep ${filter}, or internal promotions read as new hires`,
    );
  }
}
assert.ok(
  model.spec.config.limit <= 2500,
  "limit is per URL and Sales Navigator returns at most 2,500 per search",
);

const play = byId.get("play:route-new-hires");
assert.ok(play, "play:route-new-hires must exist");
assert.equal(play.spec.isEnabled, false, "the play must ship disabled");
assert.equal(play.spec.runCreationRule, "noConcurrency");
assert.deepEqual(
  play.spec.changeKinds,
  ["added"],
  "only people new to the search may create runs, or every sync re-routes the market",
);
assert.equal(
  play.spec.filter,
  undefined,
  "the search is the audience; a play filter restating it is a drift trap",
);

const nodes = play.spec.nodes;
assert.ok(Array.isArray(nodes), "the play must compile to workflow nodes");
const byUuid = new Map(nodes.map((node) => [node.uuid, node]));
const childrenOf = (node) =>
  node.childrenUuids.map((uuid) => (uuid ? byUuid.get(uuid) : undefined));
const parentOf = (node) =>
  nodes.find((candidate) => candidate.childrenUuids.includes(node.uuid));
const ancestorsOf = (node) => {
  const out = [];
  for (let parent = parentOf(node); parent; parent = parentOf(parent))
    out.push(parent);
  return out;
};
const isCrm = (node) =>
  node.kind === "connector" &&
  node.connectorUuid?.resourceId === "connector:crm";
const isEnd = (node) => node?.kind === "native" && node.actionSlug === "end";
const isBranch = (node) => node?.kind === "native" && node.actionSlug === "branch";
const findOne = (predicate, message) => {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, message);
  return matches[0];
};

// Never SOQL: lookups go through findRecords / searchRecords on every CRM.
assert.equal(
  nodes.some((node) => node.kind === "connector" && node.actionSlug === "soqlQuery"),
  false,
  "lookups use findRecords or searchRecords, never soqlQuery",
);

// Enrich first, guard the domain, match second.
const start = findOne(
  (node) => node.kind === "native" && node.actionSlug === "start",
  "one start node",
);
const enrich = childrenOf(start)[0];
assert.equal(enrich?.integrationSlug, "linkedin");
assert.equal(enrich.actionSlug, "enrichCompany");
const domainGuard = childrenOf(enrich)[0];
assert.ok(isBranch(domainGuard), "the company enrichment must be followed by the domain guard");
assert.match(domainGuard.config.condition.expression, /domain/);
const [guardThen, guardElse] = childrenOf(domainGuard);
assert.ok(isEnd(guardThen), "a company with no domain must end the run");
assert.ok(
  isCrm(guardElse) && ["searchRecords", "findRecords"].includes(guardElse.actionSlug),
  "the account lookup must follow the domain guard",
);

// The qualifier runs on the new-account route only, and gates every write.
const agent = findOne((node) => node.kind === "agent", "exactly one agent: the qualifier");
assert.equal(agent.agentUuid?.resourceId, "agent:new-hire-icp-qualifier");
const isLookup = (node) =>
  isCrm(node) && ["searchRecords", "findRecords"].includes(node.actionSlug);
assert.ok(
  ancestorsOf(agent).every((node) => !isCrm(node) || isLookup(node)),
  "the qualifier must sit on the new-account route, before any CRM write",
);
const gate = childrenOf(agent)[0];
assert.ok(isBranch(gate), "the qualifier must be followed by its gate");
assert.match(gate.config.condition.expression, /is_icp/);
assert.ok(
  childrenOf(gate).some(isEnd),
  "a company the ICP rejects must end the run without a CRM write",
);
const accountWrites = nodes.filter(
  (node) => isCrm(node) && node.actionSlug !== "searchRecords" && node.actionSlug !== "findRecords" &&
    ancestorsOf(node).includes(agent),
);
assert.ok(accountWrites.length > 0, "the new-account route must write to the CRM");

// One contact per person: the person is looked up across the CRM before the
// routes split, and every contact write keys on that lookup first, so a mover
// is moved rather than duplicated.
const accountSplit = parentOf(agent);
const personLookup = parentOf(accountSplit);
assert.ok(
  isLookup(personLookup) && personLookup.uuid !== guardElse.uuid,
  "the person lookup must sit between the account lookup and the route split",
);
const contactWrites = nodes.filter(
  (node) =>
    isCrm(node) &&
    node.actionSlug === "upsertRecords" &&
    /^contacts?$/i.test(String(node.config.objectType)),
);
assert.equal(contactWrites.length, 2, "one contact write per account state: new, and already held");
for (const write of contactWrites) {
  assert.ok(
    String(write.config.matchingPropertyName?.expression).includes(`nodes.${personLookup.slug}`),
    "a contact write must match the person found by the lookup before keying on anything else",
  );
}

// On accounts the CRM already holds, a person who is already a contact on that
// very account stops the run before the email lookup is paid for.
const emailLookups = nodes.filter(
  (node) => node.kind === "tool" && node.toolUuid === "REPLACE-WITH-FIND-EMAIL-TOOL-UUID",
);
assert.equal(emailLookups.length, 2, "one email lookup per account state: new, and already held");
const existingRouteLookup = emailLookups.find((node) => !ancestorsOf(node).includes(agent));
assert.ok(existingRouteLookup, "the existing-account route must look the email up");
const contactGate = parentOf(existingRouteLookup);
assert.ok(isBranch(contactGate), "the email lookup must be gated on the same-account check");
assert.ok(childrenOf(contactGate).some(isEnd), "a person already on the account must end the run");
assert.ok(
  contactGate.config.condition.expression.includes(`nodes.${personLookup.slug}`),
  "the same-account check must read the person lookup",
);

// Three routes tell someone, on the account: new, open opportunity, customer.
// The known-account route adds the contact and stops: no task, no allocation.
// A task on HubSpot and Salesforce; a note on Attio, which has no task write.
const tasks = nodes.filter(
  (node) => isCrm(node) &&
    ((node.actionSlug === "insertRecord" && /^tasks?$/i.test(String(node.config.objectType))) ||
      node.actionSlug === "createNote"),
);
assert.equal(tasks.length, 3, "one task each for new account, open opportunity and customer");
for (const task of tasks) {
  if (task.actionSlug === "createNote") continue;
  const props = new Set(task.config.mappings.map((mapping) => mapping.propertyName));
  if (props.has("hubspot_owner_id")) {
    // HubSpot cannot associate at insert: the task must be followed by its
    // association to the company.
    const next = childrenOf(task)[0];
    assert.equal(next?.actionSlug, "createAssociation", "a HubSpot task must be associated");
    assert.equal(next.config.toObjectType, "companies");
  } else {
    assert.ok(
      props.has("OwnerId") || props.has("assignee") || props.has("owner"),
      "a task must name its owner",
    );
  }
}
const routing = findOne(
  (node) => node.kind === "native" && node.actionSlug === "switch",
  "the existing-account routes must be one explicit switch",
);
const routes = childrenOf(routing);
assert.equal(routes.length, 3, "open opportunity, customer, known account");
assert.ok(isEnd(routes[2]), "the known-account route adds the contact and raises no task");

// Ends at the CRM write: nothing is drafted or sent.
assert.equal(
  nodes.some((node) => /send|sequence|enroll/i.test(String(node.actionSlug))),
  false,
  "the play stops at the CRM write",
);

console.log("ok: new-hire-detection contract holds");
