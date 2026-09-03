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
await import(`../infra/agents/standup.ts?contract=${stamp}`);
await import(`../infra/connectors/git.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

const findOne = (nodes, predicate, message) => {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, message);
  return matches[0];
};

assert.ok(byId.get("connector:github"), "defineConnector(github) must exist");
assert.ok(byId.get("connector:slack"), "defineConnector(slack) must exist");
assert.equal(
  byId.has("tool:post-slack"),
  false,
  "slack.postMessage must be a connector action on the agent, not a wrapped tool",
);

const agent = byId.get("agent:standup");
assert.ok(agent, "defineAgent(standup) must exist");
assert.equal(
  agent.spec.harnessSlug,
  "claudeCode",
  "standup must be a Claude Code harness agent: the output is a repo diff",
);
assert.equal(
  (agent.spec.tools ?? []).length,
  0,
  "standup must not wrap slack.postMessage in a tool",
);

const capabilitySlugs = new Set(
  (agent.spec.capabilities ?? []).map((capability) => capability.slug),
);
assert.equal(
  capabilitySlugs.has("platform"),
  true,
  "standup must carry the platform capability: runs, usage, and models are workspace data, not a git dump",
);

const post = findOne(
  agent.spec.connectorActions ?? [],
  (action) =>
    action.integration === "slack" && action.actionSlug === "postMessage",
  "standup must use slack.postMessage",
);
assert.equal(
  typeof post.config?.channelId,
  "string",
  "channelId must be locked on the postMessage use, not left for the agent to pick",
);
assert.notEqual(
  post.config.channelId,
  "",
  "channelId must not be empty",
);
assert.equal(
  post.config.format,
  "markdown",
  "format must be locked to markdown so the digest is not Block Kit the agent re-derives",
);
assert.equal(
  post.config.disableUnfurling,
  true,
  "disableUnfurling must be locked so the PR link in the last line stays a link",
);

findOne(
  agent.spec.triggers ?? [],
  (trigger) => trigger.type === "cron" && typeof trigger.cron === "string",
  "standup must have a cron trigger",
);

const env = agent.spec.repository?.env ?? [];
const envKeys = new Set(
  (Array.isArray(env) ? env : []).map((entry) => entry.key),
);
assert.equal(
  envKeys.has("STANDUP_TIMEZONE"),
  true,
  "repository.env must carry STANDUP_TIMEZONE so the collector and the prompt agree on the day",
);
assert.equal(
  envKeys.has("STANDUP_TITLE"),
  true,
  "repository.env must carry STANDUP_TITLE so the Slack header is not invented each night",
);

console.log("ok: standup contract");
