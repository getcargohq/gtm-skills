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
await import(`../infra/agents/slack-scribe.ts?contract=${stamp}`);
await import(`../infra/connectors/git.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

assert.ok(byId.get("connector:github"), "defineConnector(github) must exist: it is the only write path");
assert.ok(byId.get("connector:slack"), "defineConnector(slack) must exist");

const agent = byId.get("agent:slack_scribe");
assert.ok(agent, "defineAgent(slack_scribe) must exist");
assert.equal(
  agent.spec.harnessSlug,
  "claudeCode",
  "the scribe must be a Claude Code harness agent: its output is a repo diff under review",
);

// The harness runs against Cargo's LLM proxy, selected by the connector's
// integration: `claudeCode` with anything but `anthropic` fails at deploy.
const llm = byId.get("connector:anthropic");
assert.ok(llm, "defineConnector(anthropic) must exist: the harness needs a model");
assert.equal(
  llm.spec.integrationSlug,
  "anthropic",
  "claudeCode is proxied to Anthropic: an openAi connector deploys broken",
);
assert.ok(agent.spec.connectorUuid, "the scribe must bind the LLM connector");

// The trigger: listed channels only. A listed channel is owned by this agent;
// allChannels would put it on every mention in the workspace, shared channels
// included, alongside ask-cargo.
const slackTriggers = (agent.spec.triggers ?? []).filter(
  (trigger) => trigger.type === "connector" && trigger.integration === "slack",
);
assert.equal(slackTriggers.length, 1, "the scribe must have exactly one Slack trigger");
const [trigger] = slackTriggers;
assert.notEqual(
  trigger.config?.allChannels,
  true,
  "the scribe lists its channels: allChannels collides with ask-cargo and reaches shared channels",
);
const channelIds = trigger.config?.channelIds ?? [];
assert.ok(channelIds.length > 0, "the trigger must list at least one channel: an empty list captures nowhere");
for (const id of channelIds) {
  assert.match(
    id,
    /^[CG][A-Z0-9]+$/,
    `${id} is not a Slack channel id: list C…/G… ids from the autocomplete, not names, and no DMs`,
  );
}

// Slack on `uses`: the thread read, author names, and the done reaction. Never
// a post: the reply is the final text, which the trigger posts in the thread.
const slackActions = (agent.spec.connectorActions ?? []).filter(
  (action) => action.integration === "slack",
);
const slackSlugs = slackActions.map((action) => action.actionSlug).sort();
assert.ok(slackSlugs.includes("getThread"), "getThread must be on uses: it is how the scribe reads the thread");
const allowed = new Set(["getThread", "listUsers", "addReaction"]);
for (const slug of slackSlugs) {
  assert.ok(
    allowed.has(slug),
    `slack.${slug} must not be on uses: the scribe reads one thread and reacts; it never posts, searches or reads other channels`,
  );
}
const others = (agent.spec.connectorActions ?? []).filter(
  (action) => action.integration !== "slack",
);
assert.equal(others.length, 0, "the scribe writes only to the repository: no other connector action");

for (const key of ["tools", "subAgents", "models"]) {
  assert.equal(
    (agent.spec[key] ?? []).length,
    0,
    `the scribe must not declare ${key}: the pull request is its only write path`,
  );
}
assert.equal(
  (agent.spec.capabilities ?? []).length,
  0,
  "the scribe needs no capability: context is edited as files in the checkout, under review",
);

console.log("ok: slack-capture contract");
