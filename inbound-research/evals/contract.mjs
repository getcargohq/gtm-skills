import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

// The boundaries CDK schema validation cannot express, checked against the
// compiled registry. `cargo-cdk check` proves the resources are well formed;
// this proves they are still the pipeline this skill describes after an agent
// has adapted them.
//
// Run it from the skill folder after every adaptation:
//   node --import tsx evals/contract.mjs
resetRegistry();
const stamp = Date.now();
await import(`../infra/plays/research-inbound.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));
const conditionsOf = (filter) =>
  (filter?.groups ?? []).flatMap((group) => group.conditions ?? []);

// The worked example has no CRM dependency. The `crm-backed` variation adds
// one deliberately, and changes this assertion with it.
const crmConnectors = [...byId.values()].filter(
  (resource) =>
    resource.id.startsWith("connector:") &&
    ["hubspot", "salesforce", "attio"].includes(resource.spec.integrationSlug),
);
assert.equal(
  crmConnectors.length,
  0,
  "the worked example runs on native models: no CRM connector",
);

const contacts = byId.get("model:inbound_contacts");
assert.ok(contacts, "defineModel(inbound_contacts) must exist");
assert.equal(contacts.spec.extractorSlug, "defineContact");
assert.ok(
  byId.get("model:inbound_accounts"),
  "defineModel(inbound_accounts) must exist",
);

// The agent judges and writes nothing.
const agent = byId.get("agent:inbound_researcher");
assert.ok(agent, "defineAgent(inbound_researcher) must exist");
assert.equal(
  (agent.spec.connectorActions ?? []).length,
  0,
  "the researcher must have no connector action: the play writes and posts",
);
assert.equal(
  (agent.spec.models ?? []).length,
  0,
  "the researcher must have no model on uses: it hands back JSON",
);
const capabilities = JSON.stringify(agent.spec.capabilities ?? []);
assert.ok(
  capabilities.includes('"context"') &&
    /"isReadOnly":\s*true/.test(capabilities),
  "the researcher must read the ICP and rubric through a read-only context capability",
);

// The play: once per new contact, never twice, shipped off.
const play = byId.get("play:research_inbound_contacts");
assert.ok(play, "definePlay(research_inbound_contacts) must exist");
assert.deepEqual(
  play.spec.changeKinds,
  ["added"],
  'changeKinds must stay ["added"]: without it every tick re-researches the table',
);
assert.equal(play.spec.isEnabled, false, "the play ships disabled");
const conditions = conditionsOf(play.spec.filter);
assert.ok(
  conditions.some(
    (c) =>
      c.columnSlug === "custom__cargo_inbound_researched_at" &&
      c.operator === "isNull",
  ),
  "the play must skip contacts already researched",
);
assert.ok(
  conditions.some((c) => c.columnSlug === "lead_source" && c.operator === "is"),
  "the play must allow-list inbound lead sources",
);

// The workflow writes only the declared cargo_* columns, by bare slug, and
// never touches ownership. `id` is the account lookup, not a write.
const workflow = JSON.stringify(play.spec.nodes ?? []);
const allowed = new Set([
  "cargo_inbound_tier",
  "cargo_inbound_brief",
  "cargo_inbound_rationale",
  "cargo_inbound_researched_at",
  "cargo_tier",
  "cargo_tier_reason",
]);
const writes = [...workflow.matchAll(/columnSlug\\*":\s*\\*"([a-z_]+)/g)]
  .map((match) => match[1])
  .filter((slug) => slug !== "id");
assert.ok(writes.length > 0, "the workflow must write the research back");
for (const slug of writes) {
  assert.ok(
    allowed.has(slug),
    `the workflow writes only the declared cargo_* columns, by bare slug (a custom__ slug is dropped while the node reports success); found ${slug}`,
  );
}
assert.ok(!writes.includes("owner_id"), "the pipeline must never write an owner");
assert.ok(
  !workflow.includes("unifyAccounts") && !workflow.includes("unifyContacts"),
  "no unification step between the record and the write",
);

console.log("ok: inbound-research contract");
