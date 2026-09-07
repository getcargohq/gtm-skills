// The deduplication graph's executable contract: the boundaries CDK schema
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

assert.deepEqual(
  new Set(byId.keys()),
  new Set([
    "connector:crm",
    "connector:manual_review",
    "model:crm_accounts",
    "play:deduplicate_accounts",
  ]),
  "crm-deduplication must deploy only its CRM model, connectors, and deduplication play",
);
assert.equal(
  byId.has("model:account_duplicate_candidates"),
  false,
  "deduplication must not deploy a duplicate-candidate staging model",
);
for (const connectorId of ["connector:crm", "connector:manual_review"]) {
  assert.equal(
    byId.get(connectorId).spec.cacheTtlMilliseconds,
    15 * 24 * 60 * 60 * 1000,
    `${connectorId} must keep the maximum 15-day cache duration`,
  );
}

const play = byId.get("play:deduplicate_accounts");
assert.equal(
  play.spec.modelUuid.resourceId,
  "model:crm_accounts",
  "deduplicate_accounts must run directly on the CRM account model",
);
assert.equal(play.spec.isEnabled, false, "the dedup play must be disabled");
assert.equal(play.spec.limit, 15, "the dedup pilot must be limited to 15 rows");
assert.equal(
  play.spec.runCreationRule,
  "noConcurrency",
  "the dedup play must run serially",
);

const nodes = play.spec.nodes;
const only = (predicate, message) => {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, message);
  return matches[0];
};
const byUuid = (uuid) => nodes.find((node) => node.uuid === uuid);
const childrenOf = (node) => node.childrenUuids.map(byUuid);
const reachableFrom = (uuid, seen = new Set()) => {
  const node = byUuid(uuid);
  if (node === undefined || seen.has(node.uuid)) return seen;
  seen.add(node.uuid);
  for (const child of node.childrenUuids) reachableFrom(child, seen);
  return seen;
};
const isCrmAction = (actionSlug) => (node) =>
  node.kind === "connector" &&
  node.connectorUuid?.resourceId === "connector:crm" &&
  node.actionSlug === actionSlug;

// Search live, then reason about what came back. An audit snapshot can be
// stale by the time the row is dequeued.
const search = only(
  isCrmAction("findRecords"),
  "deduplicate_accounts must search the CRM with exactly one findRecords node",
);
const evidenceNode = childrenOf(search)[0];
assert.equal(
  evidenceNode.actionSlug,
  "script",
  "the CRM search must continue into deterministic evidence preparation",
);

const scoreNode = only(
  (node) => node.kind === "native" && node.actionSlug === "scoring",
  "duplicate evidence must be scored by exactly one native Scoring node",
);
assert.deepEqual(
  scoreNode.config.criterias.map(({ name, score }) => [
    name,
    score.expression,
  ]),
  [
    ["Exact LinkedIn company ID", "{{ 60 }}"],
    ["Exact LinkedIn company URL", "{{ 25 }}"],
    ["Exact non-generic domain", "{{ 15 }}"],
  ],
  "the native duplicate score must preserve the approved 60/25/15 policy",
);
const survivorNode = childrenOf(scoreNode)[0];
assert.equal(
  survivorNode.actionSlug,
  "script",
  "scoring must feed deterministic survivor selection",
);

// Automatic merge needs BOTH the score threshold and the exact-identity guard.
const gate = childrenOf(survivorNode)[0];
assert.equal(
  gate.actionSlug,
  "branch",
  "survivor selection must feed the guarded automatic-merge branch",
);
assert.match(
  gate.config.condition.expression,
  /scoring\.score >= 60.*autoEligible/,
  "automatic merge must require both the score threshold and the conflict guard",
);

const merges = nodes.filter(isCrmAction("mergeRecords"));
const mergeUuids = new Set(merges.map((merge) => merge.uuid));
assert.equal(
  merges.length,
  2,
  "deduplicate_accounts must expose exactly the automatic and human-approved merge paths",
);
for (const merge of merges) {
  assert.match(
    merge.config.primaryId.expression,
    /result\.primaryId/,
    "every CRM merge must use the selected survivor",
  );
  assert.match(
    merge.config.idsToMerge.expression,
    /result\.idsToMerge/,
    "every CRM merge must use the selected non-survivor IDs",
  );
}
assert.equal(
  mergeUuids.has(gate.childrenUuids[0]),
  true,
  "the guarded yes path must merge automatically",
);

const review = only(
  (node) => node.kind === "native" && node.actionSlug === "humanReview",
  "every other cluster must reach exactly one native Human review node",
);
assert.equal(
  gate.childrenUuids[1],
  review.uuid,
  "the guarded no path must request human review",
);
assert.equal(
  review.config.connectorUuid.resourceId,
  "connector:manual_review",
  "human review must post through the declared manual-review connector",
);
assert.match(
  review.config.content.expression,
  /Identity conflict:[\s\S]*Protected ID conflict:[\s\S]*Parent\/subsidiary warning:[\s\S]*Evidence:/,
  "the review message must show the score, every conflict, and the evidence",
);

const [approvedUuid, declinedUuid] = review.childrenUuids;
assert.equal(
  [...reachableFrom(approvedUuid)].some((uuid) => mergeUuids.has(uuid)),
  true,
  "approval must reach the reviewed merge",
);
assert.equal(
  [...reachableFrom(declinedUuid)].some((uuid) => mergeUuids.has(uuid)),
  false,
  "decline and timeout must never reach a CRM merge",
);

// The two script bodies run for real, against the node slugs they read. A
// connector or script node inserted ahead of either one renames those slugs,
// and these calls are what catches it.
const prepareEvidence = new Function("nodes", evidenceNode.config.script);
const selectSurvivor = new Function("nodes", survivorNode.config.script);
const company = (id, properties = {}) => ({
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
const evidenceFor = (sourceId, found) =>
  prepareEvidence({ start: { hs_object_id: sourceId }, hubspot: found });

const exact = evidenceFor("source", [
  company("source"),
  company("customer", { lifecyclestage: "customer" }),
]);
assert.equal(exact.sourceFound, true, "the fresh source must be kept");
assert.equal(exact.duplicateCount, 1, "the duplicate candidate must be kept");
assert.equal(
  exact.autoEligible,
  true,
  "an exact shared LinkedIn ID without conflicts must reach the automatic gate",
);

const survivor = selectSurvivor({ script: { result: exact } });
assert.equal(
  survivor.primaryId,
  "customer",
  "survivor selection must apply the deterministic precedence",
);
assert.deepEqual(
  survivor.idsToMerge,
  ["source"],
  "survivor selection must return every non-survivor ID",
);

const conflicting = evidenceFor("source", [
  company("source"),
  company("conflict", { domain: "other.example" }),
]);
assert.equal(
  conflicting.identityConflict,
  true,
  "conflicting non-null identity must be visible to the merge gate",
);
assert.equal(
  conflicting.autoEligible,
  false,
  "an identity conflict must require human review",
);

const parked = { linkedin_company_id: "", linkedin_company_page: "" };
const parkedDomain = evidenceFor("source", [
  company("source", { ...parked, domain: "google.com" }),
  company("other", { ...parked, domain: "google.com" }),
]);
assert.equal(
  parkedDomain.duplicateCount,
  0,
  "a generic domain alone must never create a duplicate candidate",
);

const stale = evidenceFor("already-merged", [company("survivor")]);
assert.equal(
  stale.sourceFound,
  false,
  "a source already absorbed by an earlier merge must stop before scoring",
);
assert.deepEqual(
  stale.cluster,
  [],
  "a missing fresh source must never emit a mergeable cluster",
);

console.log(
  "ok: crm-deduplication searches and scores CRM rows before a guarded merge or human review",
);
