/**
 * What has to hold about this pipeline, checked on every run of
 * `npm run validate` (scripts/check-pipelines.mjs executes this file).
 *
 * The registry half checks the compiled resources: one harness agent on a
 * weekly cron, nothing on `uses`, no capability, and above all no action that
 * speaks on LinkedIn. The prompt half checks what the prompt must keep: the
 * author guard, one file and one pull request per week, and the rule that
 * every claim is cited.
 *
 * Run it from the skill folder after every adaptation:
 *   node --import tsx evals/contract.mjs
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { loadResources } from "@cargo-ai/cdk";

const infraDir = new URL("../infra", import.meta.url).pathname;
const resources = await loadResources(infraDir);
const byId = new Map(resources.map((resource) => [resource.id, resource]));
const checks = [];
const check = (name, run) => checks.push([name, run]);

// Every LinkedIn action that acts as the author in public.
const LINKEDIN_WRITES = [
  "likePost",
  "commentPost",
  "commentPostComment",
  "connectProfile",
  "messageProfile",
  "followProfile",
  "visitProfile",
];

check("the template declares one agent, one folder and two bound connectors", () => {
  assert.deepEqual(
    [...byId.keys()].sort(),
    [
      "agent:linkedin_content_writer",
      "connector:anthropic",
      "connector:github",
      "folder:linkedin_content_agents",
    ],
  );
  for (const id of ["connector:anthropic", "connector:github"]) {
    assert.equal(byId.get(id).spec.config, undefined, `${id} must bind the workspace's connection, not declare a config`);
  }
});

check("the writer is a harness agent on a weekly cron", () => {
  const agent = byId.get("agent:linkedin_content_writer");
  assert.equal(agent.spec.harnessSlug, "claudeCode", "its output is a file in a pull request");
  assert.ok(agent.spec.connectorUuid, "the harness does not bring its own model");
  assert.equal(typeof agent.spec.languageModelSlug, "string", "it must name a languageModel");
  const triggers = agent.spec.triggers ?? [];
  assert.equal(triggers.length, 1, "one trigger: the weekly cron");
  assert.equal(triggers[0].type, "cron");
  assert.match(triggers[0].cron ?? "", /^\S+ \S+ \* \* \d$/, "weekly: one day of the week");
});

check("nothing on the agent can publish, and nothing can write context/", () => {
  const agent = byId.get("agent:linkedin_content_writer");
  const actions = agent.spec.connectorActions ?? [];
  const writes = actions.filter((action) => LINKEDIN_WRITES.includes(action.actionSlug));
  assert.equal(writes.length, 0, `the writer must not act on LinkedIn: ${writes.map((a) => a.actionSlug).join(", ")}`);
  assert.equal(actions.length, 0, "no connector action: the pull request is the only output");
  assert.equal((agent.spec.tools ?? []).length, 0, "no tool");
  assert.equal((agent.spec.nativeActions ?? []).length, 0, "no native action: nothing is sent");
  assert.equal(
    (agent.spec.capabilities ?? []).length,
    0,
    "no capability: context/ is in the checkout, and a context capability would write it without review",
  );
});

check("the author is an env var, shipped as the placeholder the prompt refuses", async () => {
  const agent = byId.get("agent:linkedin_content_writer");
  const env = agent.spec.repository?.env ?? [];
  const entry = (Array.isArray(env) ? env : []).find((e) => e.key === "CONTENT_AUTHOR");
  assert.ok(entry, "repository.env must carry CONTENT_AUTHOR");
  assert.equal(entry.value, "PLACEHOLDER", "a template must not ship written as a real person");
  const { contentWriterPrompt } = await import("../infra/agents/content-writer.prompt.ts");
  assert.ok(contentWriterPrompt.includes("reads PLACEHOLDER"), "the author guard is gone");
});

check("there is no collector script: the checkout is the input", () => {
  assert.ok(!existsSync(new URL("../scripts", import.meta.url)), "scripts/ appeared: the inputs are already in the checkout");
});

check("the prompt keeps one file and one pull request per week", async () => {
  const { contentWriterPrompt } = await import("../infra/agents/content-writer.prompt.ts");
  for (const line of [
    "cadence/content/<week>.md",
    'gh pr list --state open --search "in:title [linkedin-content] <week>"',
    "this week is already drafted: reply with its link and\nstop",
    '"[linkedin-content] <week>"',
  ]) assert.ok(contentWriterPrompt.includes(line), `prompt lost: ${line}`);
});

check("the prompt keeps every claim cited and nothing published", async () => {
  const { contentWriterPrompt } = await import("../infra/agents/content-writer.prompt.ts");
  for (const line of [
    "**Sources:**",
    "is cut, not\nsoftened",
    "Never invent a metric, a customer, a quote or a date",
    "reference_permission",
    "You never publish anything",
    "Never post, like, comment, connect or message on LinkedIn",
    "Never write under context/",
  ]) assert.ok(contentWriterPrompt.includes(line), `prompt lost: ${line}`);
});

let failed = 0;
for (const [name, run] of checks) {
  try { await run(); console.log(`ok   ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}\n     ${error.message.split("\n").join("\n     ")}`); }
}
if (failed > 0) { console.error(`${failed} contract check(s) failed`); process.exit(1); }
console.log(`${checks.length} contract checks passed`);
