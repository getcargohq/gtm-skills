import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
await import(`../infra/agents/engager.ts?contract=${Date.now()}`);

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

assert.ok(byId.get("domain:example-outreach.com"), "defineDomain must exist");
assert.ok(byId.get("mailbox:rep"), "defineMailbox(rep) must exist");

const toolNodes = nodesFor("tool:send-email");
findOne(
  toolNodes,
  (node) => node.kind === "native" && node.actionSlug === "sendEmail",
  "send-email must contain exactly one native sendEmail node",
);

const tool = byId.get("tool:send-email");
assert.equal(
  tool.spec.formFields.some((field) => field.slug === "mailboxUuid"),
  false,
  "mailboxUuid must be pinned in the workflow, not exposed as a form field",
);

const agent = byId.get("agent:engager");
assert.ok(agent, "defineAgent(engager) must exist");

const nativeEmail = findOne(
  agent.spec.triggers,
  (trigger) => trigger.type === "native" && trigger.agentSlug === "email",
  "engager must have exactly one native email trigger",
);
assert.deepEqual(
  nativeEmail.config?.kinds,
  ["replied", "unsubscribed"],
  "the native email trigger must wake on replied and unsubscribed, not opens",
);
assert.equal(
  nativeEmail.config.kinds.includes("opened"),
  false,
  "opened must not be a trigger kind",
);
assert.equal(
  nativeEmail.config.kinds.includes("interacted"),
  false,
  "interacted must not be a trigger kind",
);

const heartbeat = agent.spec.heartbeat;
assert.ok(heartbeat, "engager must declare a heartbeat — silence has no event");
assert.equal(typeof heartbeat.intervalMinutes, "number");
assert.ok(
  heartbeat.intervalMinutes >= 60,
  "heartbeat interval must be at least an hour, not a poll loop",
);
assert.ok(
  heartbeat.maxMessages >= 4,
  "heartbeat maxMessages must allow a first send plus a short thread",
);
assert.equal(typeof heartbeat.prompt, "string");
assert.match(
  heartbeat.prompt,
  /status/i,
  "heartbeat prompt must tell the agent to check thread status",
);

console.log("ok: agentic-engagement contract");
