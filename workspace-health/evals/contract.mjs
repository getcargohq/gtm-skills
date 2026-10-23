import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

// The boundaries schema validation cannot express, checked against the
// compiled registry. `cargo-ai project check` proves the resources are well formed;
// this proves they are still the pipeline this skill describes after an agent
// has adapted them.
//
// Run it from the skill folder after every adaptation:
//   node --import tsx evals/contract.mjs
resetRegistry();
const stamp = Date.now();
await import(`../infra/agents/workspace-health.ts?contract=${stamp}`);
await import(`../infra/connectors/git.ts?contract=${stamp}`);
await import(`../infra/connectors/anthropic.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

const findOne = (nodes, predicate, message) => {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, message);
  return matches[0];
};

assert.ok(byId.get("connector:github"), "defineConnector(github) must exist: the harness clones the project for its CLI");
assert.ok(byId.get("connector:slack"), "defineConnector(slack) must exist");

const agent = byId.get("agent:workspace_health");
assert.ok(agent, "defineAgent(workspace_health) must exist");
assert.equal(
  agent.spec.harnessSlug,
  "claudeCode",
  "workspace-health must be a Claude Code harness agent: the cargo-ai CLI and its orchestration SQL are its read path",
);

const llm = byId.get("connector:anthropic");
assert.ok(llm, "defineConnector(anthropic) must exist: the harness needs a model");
assert.equal(
  llm.spec.integrationSlug,
  "anthropic",
  "claudeCode is proxied to Anthropic: an openAi connector deploys broken",
);
assert.ok(
  agent.spec.connectorUuid,
  "workspace-health must bind the LLM connector: the harness does not bring its own model",
);
assert.equal(
  typeof agent.spec.languageModelSlug,
  "string",
  "workspace-health must name a languageModel: it is what the daily run is metered against",
);
assert.equal(
  (agent.spec.tools ?? []).length,
  0,
  "workspace-health must not wrap the CLI or Slack in a tool",
);

// A capability is a second read path no prompt line can narrow, and the one
// that could rerun what it reports on. The watcher reports; it never fixes.
assert.equal(
  (agent.spec.capabilities ?? []).length,
  0,
  "workspace-health needs no capability: the read path is the cargo-ai CLI in the sandbox",
);

const actions = agent.spec.connectorActions ?? [];
assert.equal(
  actions.length,
  2,
  "workspace-health has exactly two connector actions: post, and read back its own posts",
);
const post = findOne(
  actions,
  (action) => action.integration === "slack" && action.actionSlug === "postMessage",
  "workspace-health must use slack.postMessage",
);
const history = findOne(
  actions,
  (action) => action.integration === "slack" && action.actionSlug === "getConversationHistory",
  "workspace-health must use slack.getConversationHistory: it is how a finding is not reposted every morning",
);
assert.equal(
  typeof post.config?.channelId,
  "string",
  "channelId must be locked on the postMessage use, not left for the agent to pick",
);
assert.notEqual(post.config.channelId, "", "channelId must not be empty");
assert.equal(
  history.config?.channelId,
  post.config.channelId,
  "the history read must be locked to the channel it posts in, or every finding is reposted daily",
);
assert.equal(post.config.format, "markdown", "format must be locked to markdown");

findOne(
  agent.spec.triggers ?? [],
  (trigger) =>
    trigger.type === "cron" &&
    typeof trigger.cron === "string" &&
    trigger.cron.trim().endsWith("* * *"),
  "workspace-health must have a daily cron trigger",
);

const env = agent.spec.repository?.env ?? [];
const envKeys = new Set((Array.isArray(env) ? env : []).map((entry) => entry.key));
for (const key of ["HEALTH_ERROR_RATE", "HEALTH_SPEND_MULTIPLE", "HEALTH_SPEND_FLOOR"]) {
  assert.equal(
    envKeys.has(key),
    true,
    `repository.env must carry ${key}: a threshold the prompt reads instead of inventing`,
  );
}

console.log("ok: workspace-health contract");
