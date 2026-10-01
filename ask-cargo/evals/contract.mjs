import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

// The boundaries CDK schema validation cannot express, checked against the
// compiled registry. `cargo-cdk check` proves the resources are well formed;
// this proves they are still the agent this skill describes after an agent
// has adapted them.
//
// Run it from the skill folder after every adaptation:
//   node --import tsx evals/contract.mjs
resetRegistry();
const stamp = Date.now();
await import(`../infra/agents/ask-cargo.ts?contract=${stamp}`);
await import(`../infra/connectors/git.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

assert.ok(byId.get("connector:github"), "defineConnector(github) must exist");
assert.ok(byId.get("connector:slack"), "defineConnector(slack) must exist");

const agent = byId.get("agent:ask-cargo");
assert.ok(agent, "defineAgent(ask-cargo) must exist");
assert.equal(
  agent.spec.harnessSlug,
  "claudeCode",
  "ask-cargo must be a Claude Code harness agent: it reads the repo and answers changes with pull requests",
);

// The harness runs against Cargo's LLM proxy, and the proxy is selected by the
// connector's integration: `claudeCode` with anything but `anthropic`
// typechecks green and fails at deploy.
const llm = byId.get("connector:anthropic");
assert.ok(llm, "defineConnector(anthropic) must exist: the harness needs a model");
assert.equal(
  llm.spec.integrationSlug,
  "anthropic",
  "claudeCode is proxied to Anthropic: an openAi connector deploys broken",
);
assert.ok(
  agent.spec.connectorUuid,
  "ask-cargo must bind the LLM connector: the harness does not bring its own model",
);

// Nothing on `uses`. The Slack trigger replies in the thread by itself, and
// handing work to another agent goes through `cargo-ai ai message create`,
// behind a go in the thread. A sub-agent, tool or connector action here is a
// path that skips that gate, and a sub-agent handle would import another
// cookbook's folder.
for (const key of ["tools", "subAgents", "connectorActions", "models"]) {
  assert.equal(
    (agent.spec[key] ?? []).length,
    0,
    `ask-cargo must not declare ${key}: every action goes through the CLI, behind a go in the thread`,
  );
}
assert.equal(
  (agent.spec.capabilities ?? []).length,
  0,
  "ask-cargo needs no capability: the workspace read path is the cargo-ai CLI in the sandbox",
);

const slackTriggers = (agent.spec.triggers ?? []).filter(
  (trigger) => trigger.type === "connector" && trigger.integration === "slack",
);
assert.equal(slackTriggers.length, 1, "ask-cargo must have exactly one Slack trigger");
const [trigger] = slackTriggers;
// Either the workspace default (allChannels) or an explicit list, never
// neither: an empty config deploys a trigger that answers nowhere.
const channelIds = trigger.config?.channelIds ?? [];
assert.ok(
  trigger.config?.allChannels === true || channelIds.length > 0,
  "the Slack trigger must set allChannels or list channels: an empty trigger answers nowhere and looks deployed",
);
for (const id of channelIds) {
  assert.match(
    id,
    /^[CGU][A-Z0-9]+$/,
    `${id} is not a Slack id: list C…/G… channel ids or U… user ids for DMs, not names`,
  );
}

console.log("ok: ask-cargo contract");
