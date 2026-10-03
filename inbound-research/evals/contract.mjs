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

// The model pulls everything. A filter in its config is a second place the
// question "who is inbound" is asked, invisible to anyone reading the play.
const model = byId.get("model:inbound_crm_contacts");
assert.ok(model, "defineModel(inbound_crm_contacts) must exist");
assert.equal(model.spec.extractorSlug, "fetchRecords");
assert.equal(model.spec.config?.objectType, "contacts");
assert.equal(
  model.spec.config?.filter,
  undefined,
  "the contacts model must not filter: narrow in the play filter",
);
assert.equal(
  model.spec.config?.columnSelectionMode,
  "all",
  "the contacts model must extract every column",
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
  capabilities.includes('"context"') && /"isReadOnly":\s*true/.test(capabilities),
  "the researcher must read the ICP and rubric through a read-only context capability",
);
assert.ok(
  agent.spec.output?.jsonSchema?.properties?.tier,
  "the researcher must return a tier in a JSON schema",
);

// The play: once per new contact, never twice, shipped off.
const play = byId.get("play:research_inbound_contacts");
assert.ok(play, "definePlay(research_inbound_contacts) must exist");
assert.deepEqual(
  play.spec.changeKinds,
  ["added"],
  'changeKinds must stay ["added"]: without it every sync re-researches the portal',
);
assert.equal(play.spec.isEnabled, false, "the play ships disabled");
const conditions = conditionsOf(play.spec.filter);
assert.ok(
  conditions.some(
    (c) =>
      c.columnSlug === "cargo_inbound_researched_at" && c.operator === "isNull",
  ),
  "the play must skip contacts already researched",
);
assert.ok(
  conditions.some(
    (c) =>
      c.columnSlug === "hs_analytics_source" &&
      c.operator === "isNot" &&
      JSON.stringify(c.values).includes("OFFLINE"),
  ),
  "the play must exclude contacts that did not come in through an online source",
);

// The write-back targets the HubSpot record id, with the guard on the
// judgment, and nothing in the workflow touches ownership.
const workflow = JSON.stringify(play.spec.nodes ?? play.spec);
assert.ok(
  workflow.includes("hs_object_id"),
  "the write must match on the HubSpot record id the row came with",
);
assert.ok(
  workflow.includes("skipIfExist"),
  "the tier and brief writes must be fill-blank",
);
assert.ok(
  !/propertyName\\*":\s*\\*"hubspot_owner_id/.test(workflow),
  "the pipeline must never write an owner",
);
assert.ok(
  !workflow.includes("unifyAccounts") && !workflow.includes("unifyContacts"),
  "no unification step between the extract and the write",
);

console.log("ok: inbound-research contract");
