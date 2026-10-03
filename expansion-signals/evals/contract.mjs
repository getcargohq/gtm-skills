import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

// The boundaries CDK schema validation cannot express, checked against the
// compiled registry. Run it from the skill folder after every adaptation:
//   node --import tsx evals/contract.mjs
resetRegistry();
const stamp = Date.now();
await import(`../infra/plays/flag-expansion.ts?contract=${stamp}`);
await import(`../infra/agents/digest.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

const findOne = (nodes, predicate, message) => {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, message);
  return matches[0];
};

// Both CRM models pull everything: which companies are judged is the play's
// filter, not a second question hidden in the extractor.
for (const [id, objectType] of [
  ["model:crm_companies", "companies"],
  ["model:crm_deals", "deals"],
]) {
  const model = byId.get(id);
  assert.ok(model, `${id} must exist`);
  const config = JSON.stringify(model.spec);
  assert.ok(config.includes(`"objectType":"${objectType}"`), `${id} extracts ${objectType}`);
  assert.ok(config.includes('"columnSelectionMode":"all"'), `${id} must pull every column`);
  assert.ok(!/"filter"/.test(config), `${id} must not filter in its config`);
}

// The play: one agent judgment, one CRM write on the company id, three
// Cargo-owned properties, and nothing else written anywhere.
const play = byId.get("play:flag_expansion");
assert.ok(play, "play:flag_expansion must exist");
assert.equal(play.spec.isEnabled, false, "the play ships disabled until the pilot is approved");
const nodes = play.spec.nodes;
findOne(
  nodes,
  (node) => node.kind === "agent" && node.agentUuid?.resourceId === "agent:expansion_analyst",
  "flag_expansion must call the analyst once",
);
const writes = nodes.filter((node) => node.kind === "connector");
assert.equal(writes.length, 1, "flag_expansion must own exactly one connector call: the company write");
const [write] = writes;
assert.equal(write.actionSlug, "updateRecords");
assert.equal(write.config.objectType, "companies", "only the company record is written, never a deal or contact");
assert.equal(
  write.config.matchingPropertyName,
  "hs_object_id",
  "the write matches the CRM record id directly, with no unify step in between",
);
assert.deepEqual(
  new Set(write.config.mappings.map((mapping) => mapping.propertyName)),
  new Set(["cargo_expansion_signal", "cargo_expansion_reason", "cargo_expansion_signal_at"]),
  "the play writes only Cargo's three expansion properties",
);

// The analyst reads, never writes.
const analyst = byId.get("agent:expansion_analyst");
assert.ok(analyst, "agent:expansion_analyst must exist");
assert.equal((analyst.spec.connectorActions ?? []).length, 0, "the analyst has no connector action: the play writes");
for (const model of analyst.spec.models ?? []) {
  assert.equal(model.readOnly, true, "every model on the analyst is read-only");
}
const analystCaps = JSON.stringify(analyst.spec.capabilities ?? []);
assert.ok(analystCaps.includes("context"), "the analyst reads the expansion plays from the workspace context");
assert.ok(/"isReadOnly":\s*true/.test(analystCaps), "the context capability is read-only");
assert.equal(analyst.spec.output?.type, "jsonSchema", "the analyst answers in the JSON shape the play maps");

// The digest: one locked Slack post, a ledger it writes, the CRM read-only.
const digest = byId.get("agent:expansion_digest");
assert.ok(digest, "agent:expansion_digest must exist");
const digestActions = digest.spec.connectorActions ?? [];
const post = findOne(
  digestActions,
  (action) => action.integration === "slack" && action.actionSlug === "postMessage",
  "the digest must use slack.postMessage",
);
assert.equal(typeof post.config?.channelId, "string", "channelId must be locked on postMessage");
assert.notEqual(post.config.channelId, "", "channelId must not be empty");
assert.equal(
  digestActions.length,
  1,
  "the digest has no CRM action and no Slack read: the ledger is the dedupe",
);
const digestModels = digest.spec.models ?? [];
assert.equal(
  findOne(digestModels, (m) => m.uuid?.resourceId === "model:expansion_digests", "the digest writes its ledger").readOnly,
  false,
);
assert.equal(
  findOne(digestModels, (m) => m.uuid?.resourceId === "model:crm_companies", "the digest reads crm_companies").readOnly,
  true,
);
findOne(
  digest.spec.triggers ?? [],
  (trigger) => trigger.type === "cron",
  "the digest must have one cron trigger",
);

console.log("ok: expansion-signals contract");
