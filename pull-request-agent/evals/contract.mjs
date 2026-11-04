import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

// The boundaries schema validation cannot express, checked against the
// compiled registry. `cargo-ai project check` proves the resources are well
// formed; this proves they are still the agent this skill describes after an
// agent has adapted them.
//
// Run it from the skill folder after every adaptation:
//   node --import tsx evals/contract.mjs
resetRegistry();
const stamp = Date.now();
await import(`../infra/agents/pull-request-agent.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

assert.ok(byId.get("connector:github"), "defineConnector(github) must exist");

const agent = byId.get("agent:pull_request_agent");
assert.ok(agent, "defineAgent(pull_request_agent) must exist");
assert.equal(
  agent.spec.harnessSlug,
  "claudeCode",
  "the pull request agent must be a Claude Code harness agent: it checks out the branch, plans it and pushes to it",
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
  "the agent must bind the LLM connector: the harness does not bring its own model",
);

// Nothing on `uses`, no capability. Anyone who can comment on the repository
// steers this agent, so it gets no path to spend, send or wake another agent.
for (const key of ["tools", "subAgents", "connectorActions", "models"]) {
  assert.equal(
    (agent.spec[key] ?? []).length,
    0,
    `the pull request agent must not declare ${key}: anyone who can comment steers it`,
  );
}
assert.equal(
  (agent.spec.capabilities ?? []).length,
  0,
  "the pull request agent needs no capability: the workspace read path is the cargo-ai CLI in the sandbox",
);

// The sandbox's Cargo session is a viewer service user, never the deployer.
// Without `runAs`, `cargo-ai project plan` has no session; with a broader role
// a comment that talks the agent past its prompt can deploy.
assert.ok(
  agent.spec.repository?.runAsUserUuid,
  "the agent must run as a service user (repository.runAs): plan needs a Cargo session",
);
const user = byId.get("user:pull_request_agent");
assert.ok(user, "defineUser(pull_request_agent) must exist");
assert.equal(user.spec.kind, "service", "pull_request_agent must be a service user");
const role = byId.get("role:viewer");
assert.ok(
  role?.spec.adopt === true,
  "pull_request_agent must hold the adopted viewer system role",
);

const githubTriggers = (agent.spec.triggers ?? []).filter(
  (trigger) => trigger.type === "connector" && trigger.integration === "github",
);
assert.equal(githubTriggers.length, 1, "the agent must have exactly one GitHub trigger");
const [trigger] = githubTriggers;
// Without it, a mention only reaches a pull request this agent opened, and it
// opens none on its own: the trigger deploys and the agent never answers.
assert.equal(
  trigger.config?.allPullRequests,
  true,
  "the GitHub trigger must set allPullRequests: otherwise it answers only on pull requests it opened, which is none",
);

assert.equal(
  (agent.spec.triggers ?? []).length,
  1,
  "the pull request agent has one trigger: a Slack or cron trigger is a different agent (ask-cargo, standup)",
);

console.log("ok: pull-request-agent contract");
