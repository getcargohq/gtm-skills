// The lookalike pipeline's executable contract: the graph boundaries schema
// validation cannot express, checked against the compiled resources, plus the
// gate scripts called directly.
//
// It loads through `loadResources`, the same loader `cargo-ai project check`,
// `plan`, and `deploy` use, so what is asserted here is what would deploy.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadResources } from "@cargo-ai/cdk";

import { gateAccount } from "../infra/scripts/lookalikes/gate-account.ts";
import { gateContact } from "../infra/scripts/lookalikes/gate-contact.ts";
import { scorePersona } from "../infra/scripts/lookalikes/score-persona.ts";

const infraDir = fileURLToPath(new URL("../infra", import.meta.url));
const byId = new Map(
  (await loadResources(infraDir)).map((resource) => [resource.id, resource]),
);

assert.deepEqual(
  new Set(byId.keys()),
  new Set([
    "agent:account_qualifier",
    "agent:contact_finder",
    "agent:lookalike_researcher",
    "agent:opener_writer",
    "connector:ai_ark",
    "connector:anthropic",
    "connector:email_verification",
    "folder:customer_lookalikes_agents",
    "folder:customer_lookalikes_models",
    "folder:customer_lookalikes_plays",
    "model:lookalike_prospects",
    "model:lookalike_seeds",
    "play:find_lookalikes",
  ]),
  "customer-lookalikes deploys two models, four agents, three connectors and one play, and nothing else",
);

const play = byId.get("play:find_lookalikes");
assert.equal(play.spec.modelUuid.resourceId, "model:lookalike_seeds");
assert.equal(play.spec.isEnabled, false, "the play ships disabled");
assert.ok(
  play.spec.changeKinds.includes("unchanged"),
  "an unchanged customer still yields new lookalikes each month",
);

const top = play.spec.nodes;
const all = [...top];
const group = top.find((node) => node.actionSlug === "group");
assert.ok(group, "the play loops over the researcher's lookalikes");
assert.match(JSON.stringify(group.config.items), /lookalikes/);
const inner = group.config._nodes;
all.push(...inner);

// Nothing is sent to anyone: the pipeline ends at the row.
assert.equal(
  all.some((node) => node.actionSlug === "sendEmail"),
  false,
  "no node sends email",
);

// The researcher is told what never to return.
const researcher = top.find(
  (node) => node.agentUuid?.resourceId === "agent:lookalike_researcher",
);
const searchesBeforeResearch = top.filter(
  (node) => node.actionSlug === "modelSearch",
);
assert.equal(
  searchesBeforeResearch.length,
  2,
  "customers and already-found companies are read before the research",
);
for (const search of searchesBeforeResearch) {
  assert.ok(
    researcher.config.prompt.expression.includes(`nodes.${search.slug}`),
    `the researcher's prompt carries the ${search.slug} exclusions`,
  );
}

// Inside the loop: skip what is known, then the gates in order, each writing
// its verdict before it can stop the iteration.
const byUuid = (uuid) => inner.find((node) => node.uuid === uuid);
const startNode = inner.find((node) => node.actionSlug === "start");
const walk = [];
let cursor = byUuid(startNode.childrenUuids[0]);
while (cursor !== undefined) {
  walk.push(cursor);
  if (cursor.actionSlug === "branch") {
    assert.equal(
      cursor.childrenUuids[0],
      null,
      `${cursor.slug} stops the iteration on its first branch`,
    );
    cursor = byUuid(cursor.childrenUuids[1]);
  } else {
    cursor = byUuid(cursor.childrenUuids[0]);
  }
}
const step = (node) => {
  if (node.kind === "agent") return node.agentUuid.resourceId;
  if (node.actionSlug === "script") {
    return "script:" + /return (\w+)\(/.exec(node.config.script)[1];
  }
  return node.actionSlug;
};
assert.deepEqual(
  walk.map(step),
  [
    "modelSearch",
    "branch",
    "agent:account_qualifier",
    "script:gateAccount",
    "modelUpsert",
    "branch",
    "agent:contact_finder",
    "script:gateContact",
    "modelUpsert",
    "branch",
    "verifyEmail",
    "script:scorePersona",
    "modelUpsert",
    "branch",
    "agent:opener_writer",
    "modelUpsert",
  ],
  "skip known, then account, contact, verified email and persona gates, each written before it stops; the writer runs last",
);
const verify = walk.find((node) => node.actionSlug === "verifyEmail");
assert.equal(
  verify.fallbackOnFailure,
  true,
  "a failed verification is read as not verified, not as a failed company",
);
for (const upsert of walk.filter((node) => node.actionSlug === "modelUpsert")) {
  assert.equal(upsert.config.modelUuid.resourceId, "model:lookalike_prospects");
  assert.equal(
    upsert.config.matchingColumnSlug,
    "domain",
    "one row per company",
  );
  assert.ok(
    upsert.config.mappings.some((mapping) => mapping.columnSlug === "verdict"),
    `${upsert.slug} writes a verdict`,
  );
}

// The agents judge and write nothing; the play persists.
for (const id of [
  "agent:lookalike_researcher",
  "agent:account_qualifier",
  "agent:contact_finder",
  "agent:opener_writer",
]) {
  const spec = byId.get(id).spec;
  assert.equal((spec.models || []).length, 0, `${id} holds no model`);
  assert.equal((spec.nativeActions || []).length, 0, `${id} sends nothing`);
}
assert.match(
  JSON.stringify(byId.get("agent:lookalike_researcher").spec.connectorActions),
  /searchCompanies/,
);
assert.match(
  JSON.stringify(byId.get("agent:contact_finder").spec.connectorActions),
  /enrichPerson/,
);
for (const id of [
  "agent:lookalike_researcher",
  "agent:account_qualifier",
  "agent:contact_finder",
]) {
  assert.ok(
    JSON.stringify(byId.get(id).spec.capabilities).includes("context"),
    `${id} reads the lookalike rubric from the workspace context`,
  );
}

// The gates, called directly.
assert.equal(
  gateAccount({ account: { account_fit: 70, situation: 20, tier: "1" } })
    .viable,
  true,
);
assert.equal(
  gateAccount({ account: { account_fit: 44, situation: 20, tier: "1" } })
    .verdict,
  "not_viable",
);
assert.equal(
  gateAccount({ account: { account_fit: 90, situation: 5, tier: "2" } }).viable,
  false,
  "a fit with nothing happening now waits",
);
assert.equal(
  gateAccount({ account: { account_fit: 90, situation: 30, tier: "reject" } })
    .viable,
  false,
);

assert.equal(
  gateContact({ contact: { found: true, email: "" } }).verdict,
  "viable_no_contact",
);
assert.equal(
  gateContact({ contact: { found: true, email: "pat@northwind.example" } })
    .found,
  true,
);

const recent = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);
const tierOne = scorePersona({
  personaTier: "1",
  verification: { email_status: "valid" },
  startedRoleOn: recent,
});
assert.equal(tierOne.qualified, true);
assert.equal(tierOne.verdict, "qualified");
const tierTwo = scorePersona({
  personaTier: "2",
  verification: { email_status: "valid" },
  startedRoleOn: "",
});
assert.equal(tierTwo.qualified, true, "tier 2 with a verified email qualifies");
assert.ok(
  tierOne.personaScore > tierTwo.personaScore,
  "a new tier 1 ranks above a tier 2",
);
assert.equal(
  scorePersona({
    personaTier: "3",
    verification: { email_status: "valid" },
    startedRoleOn: recent,
  }).verdict,
  "viable_contact_not_qualified",
);
assert.equal(
  scorePersona({
    personaTier: "1",
    verification: { email_status: "catch_all" },
    startedRoleOn: "",
  }).verdict,
  "viable_email_not_verified",
);
assert.equal(
  scorePersona({ personaTier: "1", verification: null, startedRoleOn: "" })
    .emailStatus,
  "unknown",
  "a failed verification never reads as valid",
);

console.log("ok: customer-lookalikes contract");
