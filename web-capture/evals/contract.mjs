/**
 * What has to hold about this cookbook, checked on every run of
 * `npm run validate` (scripts/check-pipelines.mjs executes this file).
 *
 * Two halves. The registry half checks the compiled resources for the
 * boundaries CDK schema validation cannot express: one harness agent on a
 * weekly cron, nothing on `uses`, no capability, nothing deployed that bills,
 * and no connector for a system this cookbook must not read. The prompt half
 * checks what the prompt must keep, since it is the whole procedure: the
 * placeholder guard, the exact read commands, the baseline and the files.
 *
 * Run it from the skill folder after every adaptation:
 *   node --import tsx evals/contract.mjs
 *
 * It loads through `loadResources`, the same loader `cargo-ai cdk check`,
 * `plan`, and `deploy` use, so what is asserted here is what would deploy.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { loadResources } from "@cargo-ai/cdk";

const infraDir = new URL("../infra", import.meta.url).pathname;
const resources = await loadResources(infraDir);
const byId = new Map(resources.map((resource) => [resource.id, resource]));
const checks = [];
const check = (name, run) => checks.push([name, run]);

check("the template declares one agent, one folder and two bound connectors", () => {
  assert.deepEqual(
    [...byId.keys()].sort(),
    ["agent:web_scribe", "connector:anthropic", "connector:github", "folder:web_capture_agents"],
  );
  for (const id of ["connector:anthropic", "connector:github"]) {
    assert.equal(byId.get(id).spec.config, undefined, `${id} must bind the workspace's connection, not declare a config`);
  }
});

check("the scribe is a harness agent on a weekly cron, with no actions, tools or capability", () => {
  const agent = byId.get("agent:web_scribe");
  assert.equal(agent.spec.harnessSlug, "claudeCode", "its output is a repo diff");
  assert.ok(agent.spec.connectorUuid, "the harness does not bring its own model");
  assert.equal(typeof agent.spec.languageModelSlug, "string", "it must name a languageModel");
  const triggers = agent.spec.triggers ?? [];
  assert.equal(triggers.length, 1, "one trigger: the weekly cron");
  assert.equal(triggers[0].type, "cron");
  assert.match(triggers[0].cron ?? triggers[0].config?.cron ?? "", /^\S+ \S+ \* \* \d$/, "weekly: one day of the week");
  assert.equal((agent.spec.connectorActions ?? []).length, 0, "it posts nothing: its only output is the pull request");
  assert.equal((agent.spec.tools ?? []).length, 0, "no tool");
  assert.equal((agent.spec.capabilities ?? []).length, 0, "a context capability would be a write path that skips the pull request");
  const env = agent.spec.repository?.env ?? [];
  assert.equal((Array.isArray(env) ? env : Object.keys(env)).length, 0, "no env: the domain is in the prompt, and there is no credential");
});

check("there is no collector script: the prompt is the whole procedure", () => {
  assert.ok(!existsSync(new URL("../scripts", import.meta.url)), "scripts/ came back: the commands live in the prompt");
});

check("the shipped domain is the placeholder, and the prompt refuses it", async () => {
  const { DOMAIN, webScribePrompt } = await import("../infra/agents/web-scribe.prompt.ts");
  assert.equal(DOMAIN, "PLACEHOLDER_COMPANY_DOMAIN", "a template must not ship pointed at a real company");
  assert.ok(webScribePrompt.includes("If that line reads PLACEHOLDER_COMPANY_DOMAIN"), "the guard is gone");
});

check("the prompt spells out the exact reads, the baseline and the files", async () => {
  const { PAGES, webScribePrompt } = await import("../infra/agents/web-scribe.prompt.ts");
  for (const line of [
    '"integrationSlug":"parallel","actionSlug":"extract"',
    '"integrationSlug":"parallel","actionSlug":"createTask"',
    '"processor":"lite"',
    "git log -1 --format=%cs origin/HEAD -- cadence/log/raw/web",
    "git diff origin/HEAD -- cadence/log/raw/web/pages",
    "cadence/log/raw/web/news/<today>.json",
    "verbatim",
    "Do not fetch pages or search the news any other\nway",
  ]) assert.ok(webScribePrompt.includes(line), `prompt lost: ${line}`);
  for (const name of Object.keys(PAGES)) {
    assert.ok(webScribePrompt.includes(`cadence/log/raw/web/pages/${name}.md`), `page ${name} has no file`);
  }
  const extract = webScribePrompt.match(/--data '(\{"urls".*?\})'/);
  assert.ok(extract, "the extract command must carry its data");
  assert.equal(JSON.parse(extract[1]).urls.length, Object.keys(PAGES).length, "one call reads every page");
});

check("the prompt carries the contract's fixed points and reads only the web", async () => {
  const { webScribePrompt } = await import("../infra/agents/web-scribe.prompt.ts");
  for (const line of [
    "[R:", "[I:", "[TR:",
    "you never edit, rename or delete an existing file",
    "insight/<today>-web.md",
    "The first run always opens a pull request",
    "open no pull\nrequest",
    "Never write to the workspace context repository directly",
  ]) assert.ok(webScribePrompt.includes(line), `prompt lost: ${line}`);
  for (const word of ["hubspot", "salesforce", "theirstack", "postMessage", "cadence/log/calls"]) {
    assert.ok(!webScribePrompt.toLowerCase().includes(word.toLowerCase()), `prompt mentions ${word}: this cookbook reads the web and nothing else`);
  }
});

let failed = 0;
for (const [name, run] of checks) {
  try { await run(); console.log(`ok   ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}\n     ${error.message.split("\n").join("\n     ")}`); }
}
if (failed > 0) { console.error(`${failed} contract check(s) failed`); process.exit(1); }
console.log(`${checks.length} contract checks passed`);
