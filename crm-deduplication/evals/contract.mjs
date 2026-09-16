// The deduplication graph's executable contract: the boundaries CDK schema
// validation cannot express, checked against the compiled resources.
//
// It loads through `loadResources`, the same loader `cargo-ai cdk check`,
// `plan`, and `deploy` use, so what is asserted here is what would deploy.
import assert from "node:assert/strict";
import { loadResources } from "@cargo-ai/cdk";

import { deriveEvidence } from "../infra/scripts/evidence.ts";

const infraDir = new URL("../infra", import.meta.url).pathname;
const byId = new Map(
  (await loadResources(infraDir)).map((resource) => [resource.id, resource]),
);

assert.deepEqual(
  new Set(byId.keys()),
  new Set([
    "connector:crm",
    "connector:slack",
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
// Every merge decision rests on what the CRM returns during the run. A cached
// connector could serve `findRecords` a stale cluster, which is the one thing
// the fresh-source guard cannot catch.
for (const connectorId of ["connector:crm", "connector:slack"]) {
  assert.equal(
    byId.get(connectorId).spec.cacheTtlMilliseconds,
    undefined,
    `${connectorId} must not cache: a merge acts on what the CRM returns now`,
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
// Survivor selection rides in the evidence script, so no script reads another
// script's output. That coupling is invisible in TypeScript and breaks the
// moment a node is inserted ahead of the one being read, so forbid it outright
// rather than test around it.
for (const node of nodes.filter((node) => node.actionSlug === "script")) {
  assert.doesNotMatch(
    node.config.script,
    /nodes\.script\b/,
    "no script may read another script through its compiler-assigned slug",
  );
}

// The evidence node must carry the bundle, not a hand-written body: that is
// what keeps the module this file imports and the code a run executes identical.
assert.match(
  evidenceNode.config.script,
  /Generated from evidence\.ts/,
  "the evidence node must be bundled from infra/scripts/evidence.ts",
);
// The script takes the search and the record ID as values; the SDK writes where
// each lives. Checked here because it is the one place the wiring is visible:
// the fresh search, not the enrolled extract, and the enrolled row's own ID.
assert.match(
  evidenceNode.config.script,
  new RegExp(
    `\\(\\{ "found": nodes\\.${search.slug}, "sourceId": nodes\\.start\\.hs_object_id \\}`,
  ),
  "the evidence script must receive the live CRM search and the enrolled record ID",
);

// Automatic merge needs BOTH the score threshold and the exact-identity guard.
const gate = childrenOf(scoreNode)[0];
assert.equal(
  gate.actionSlug,
  "branch",
  "scoring must feed the guarded automatic-merge branch",
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
  "connector:slack",
  "human review must post through the declared Slack review connector",
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

// The evidence module runs for real. Imported rather than reconstructed from
// the compiled node: calling `deriveEvidence(…)` bundles this exact module, so
// calling it here and calling it in a run are the same code — and because it
// takes values rather than reading `nodes.<slug>`, the test hands it values too.
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
const evidenceFor = (sourceId, found) => deriveEvidence({ found, sourceId });

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

assert.equal(
  exact.primaryId,
  "customer",
  "survivor selection must apply the deterministic precedence",
);
assert.deepEqual(
  exact.idsToMerge,
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
// What "stop before scoring" has to mean downstream. The cluster itself is no
// longer in the payload — nothing at runtime read it — so assert the guarantee
// it stood for: a source the search no longer returns names nothing to merge.
assert.equal(
  stale.primaryId,
  undefined,
  "a missing fresh source must never name a survivor",
);
assert.deepEqual(
  stale.idsToMerge,
  [],
  "a missing fresh source must never emit a merge ID",
);

console.log(
  "ok: crm-deduplication searches and scores CRM rows before a guarded merge or human review",
);
