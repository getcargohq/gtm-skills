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
await import(`../infra/agents/planner.ts?contract=${stamp}`);
await import(`../infra/connectors/git.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

const findOne = (nodes, predicate, message) => {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, message);
  return matches[0];
};

assert.ok(byId.get("connector:github"), "defineConnector(github) must exist");
assert.equal(
  byId.has("connector:slack"),
  false,
  "weekly-planning posts nothing to Slack: recommendations are pull requests",
);
assert.equal(
  byId.has("tool:post-slack"),
  false,
  "weekly-planning must not wrap a Slack action in a tool",
);

const agent = byId.get("agent:weekly-planning");
assert.ok(agent, "defineAgent(weekly-planning) must exist");
assert.equal(
  agent.spec.harnessSlug,
  "claudeCode",
  "weekly-planning must be a Claude Code harness agent: the output is a repo diff",
);
assert.equal(
  (agent.spec.tools ?? []).length,
  0,
  "weekly-planning must not wrap platform or git in a tool",
);
assert.equal(
  (agent.spec.connectorActions ?? []).length,
  0,
  "weekly-planning has no connector actions: it writes pull requests, it does not post",
);

const capabilitySlugs = new Set(
  (agent.spec.capabilities ?? []).map((capability) => capability.slug),
);
assert.equal(
  capabilitySlugs.has("platform"),
  true,
  "weekly-planning must carry the platform capability: runs, usage, and models are workspace data, not a git dump",
);

findOne(
  agent.spec.triggers ?? [],
  (trigger) =>
    trigger.type === "cron" &&
    typeof trigger.cron === "string" &&
    trigger.cron.includes("* 1"),
  "weekly-planning must have a Monday cron trigger",
);

const env = agent.spec.repository?.env ?? [];
const envKeys = new Set(
  (Array.isArray(env) ? env : []).map((entry) => entry.key),
);
assert.equal(
  envKeys.has("PLANNING_TIMEZONE"),
  true,
  "repository.env must carry PLANNING_TIMEZONE so the collector and the prompt agree on the week",
);

console.log("ok: weekly-planning contract");
