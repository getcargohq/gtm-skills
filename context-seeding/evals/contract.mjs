/**
 * What has to hold about this cookbook, checked on every run of
 * `npm run validate` (scripts/check-pipelines.mjs executes this file).
 *
 * Two halves. The registry half checks the compiled resources for the
 * boundaries CDK schema validation cannot express: one harness agent, no
 * trigger, nothing on `uses`, nothing deployed that bills, and no connector
 * for a system this cookbook must not read. The script half checks the
 * collector's invariants against canned data with no network: the budget
 * rule and the pull spec.
 *
 * Run it from the skill folder after every adaptation:
 *   node --import tsx evals/contract.mjs
 */
import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
const stamp = Date.now();
await import(`../infra/agents/context-seeding.ts?contract=${stamp}`);
await import(`../infra/connectors/git.ts?contract=${stamp}`);
await import(`../infra/connectors/theirstack.ts?contract=${stamp}`);
await import(`../infra/models/persona-jobs.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));
const checks = [];
const check = (name, run) => checks.push([name, run]);

check("the three connectors exist and bind, never create", () => {
  for (const [id, integration] of [
    ["connector:github", "github"],
    ["connector:anthropic", "anthropic"],
    ["connector:their_stack", "theirStack"],
  ]) {
    const connector = byId.get(id);
    assert.ok(connector, `${id} must exist`);
    assert.equal(connector.spec.integrationSlug, integration);
    assert.equal(connector.spec.config, undefined, `${id} must bind the workspace's connection, not declare a config`);
  }
});

check("no connector to a system this cookbook must not read", () => {
  for (const connector of resources().filter((r) => r.id.startsWith("connector:"))) {
    assert.ok(
      !["hubspot", "salesforce", "attio", "slack"].includes(connector.spec.integrationSlug),
      `${connector.id} binds ${connector.spec.integrationSlug}: the public surface is this cookbook's only source`,
    );
  }
});

check("no defineContext: the project's own root context/ is the singleton", () => {
  for (const id of byId.keys()) assert.ok(!id.startsWith("context:"), `${id} would collide with the scaffold's`);
});

check("the seeding agent is a harness agent with no trigger, no actions and no capability", () => {
  const agent = byId.get("agent:context-seeding");
  assert.ok(agent, "defineAgent(context-seeding) must exist");
  assert.equal(agent.spec.harnessSlug, "claudeCode", "its output is a repo diff");
  assert.ok(agent.spec.connectorUuid, "the harness does not bring its own model");
  assert.equal(typeof agent.spec.languageModelSlug, "string", "it must name a languageModel");
  assert.equal(byId.get("connector:anthropic").spec.integrationSlug, "anthropic", "claudeCode is proxied to Anthropic");
  assert.equal((agent.spec.triggers ?? []).length, 0, "it runs once by hand or at setup: a cron would re-crawl monthly and ask nobody anything");
  assert.equal((agent.spec.connectorActions ?? []).length, 0, "it posts nothing: its only output is the pull request");
  assert.equal((agent.spec.tools ?? []).length, 0, "no tool");
  assert.equal((agent.spec.capabilities ?? []).length, 0, "a context capability would be a write path that skips the pull request");
  const env = agent.spec.repository?.env ?? [];
  assert.equal((Array.isArray(env) ? env : Object.keys(env)).length, 0, "no env: the pull spec is in scripts/, and there is no credential");
});

check("exactly one agent deploys", () => {
  const agents = [...byId.keys()].filter((id) => id.startsWith("agent:"));
  assert.deepEqual(agents, ["agent:context-seeding"], "one cookbook, one use case, one agent");
});

check("no persona model deploys by default", () => {
  const models = [...byId.keys()].filter((id) => id.startsWith("model:"));
  assert.deepEqual(models, [], `a model here bills its first pull at deploy before any persona is confirmed: ${models.join(", ")}`);
});

check("the model builder and the collector ask TheirStack the same question", async () => {
  const { personaJobsModel, personaPullConfig } = await import(`../infra/models/persona-jobs.ts?contract=${stamp}`);
  const { pullConfig } = await import("../scripts/collect/personas.ts");
  const pull = { slug: "probe", titles: ["Head of Probes"], exclude: ["intern"], band: { min: 20, max: 200 }, limit: 7 };
  assert.deepEqual(personaPullConfig(pull), pullConfig(pull), "infra/models/persona-jobs.ts and scripts/collect/personas.ts must build byte-identical configs");
  const config = pullConfig(pull);
  assert.equal(config.companyFields.min_employee_count, 20);
  assert.equal(config.companyFields.max_employee_count, 200);
  assert.equal(config.companyFields.company_type, "direct_employer");
  assert.equal(config.limit, 7, "limit is the budget: billing is per returned posting");
  const handle = personaJobsModel(pull);
  assert.equal(handle.slug, "persona_jobs_probe");
  const model = resources().find((r) => r.id === "model:persona_jobs_probe");
  assert.ok(model, "the builder registers a model");
  assert.equal(model.spec.extractorSlug, "fetchJobs");
  assert.equal(model.spec.schedule, undefined, "no schedule by default");
});

check("the shipped persona pulls are placeholders inside a size band", async () => {
  const { PERSONA_PULLS } = await import("../scripts/collect/personas.ts");
  assert.ok(PERSONA_PULLS.length >= 1, "at least one pull ships so the collector has something to dry-run");
  for (const pull of PERSONA_PULLS) {
    assert.match(pull.slug, /^[a-z][a-z0-9_]*$/, `${pull.slug} is not snake_case`);
    assert.ok(pull.titles.length > 0, `${pull.slug} has no titles`);
    assert.ok(pull.band.min > 0 && pull.band.max > pull.band.min, `${pull.slug} has no size band: size is filtered at pull time, never after`);
    assert.ok(pull.limit > 0, `${pull.slug} has no limit`);
  }
});

check("the budget rule sizes the pull to the balance and refuses a pull that cannot saturate", async () => {
  const { personaPullBudget } = await import("../scripts/collect/budget.ts");
  let b = personaPullBudget({ balance: 0, unitPrice: 0.5, billsCredits: false, personas: 4 });
  assert.equal(b.limit, 40); assert.equal(b.extendTo, 80); assert.equal(b.spend, 0);
  b = personaPullBudget({ balance: 100, unitPrice: 0.5, billsCredits: true, personas: 4 });
  assert.equal(b.limit, 25); assert.equal(b.extendTo, 25, "no second batch when the share cannot fund it for every persona"); assert.equal(b.spend, 50);
  b = personaPullBudget({ balance: 40, unitPrice: 0.5, billsCredits: true, personas: 4 });
  assert.equal(b.limit, 0); assert.equal(b.spend, 0);
  b = personaPullBudget({ balance: 5000, unitPrice: 0.5, billsCredits: true, personas: 4 });
  assert.equal(b.limit, 40); assert.equal(b.extendTo, 80); assert.equal(b.spend, 80);
  b = personaPullBudget({ balance: 5000, unitPrice: 0, billsCredits: true, personas: 4 });
  assert.equal(b.limit, 0, "no price: refuse rather than guess");
});

check("an argument the collector does not know stops the run", async () => {
  const { checkFlags, ConfigError } = await import("../scripts/collect/cli.ts");
  checkFlags(["--dry-run", "--persona=x"], ["--dry-run", "--persona="]);
  for (const argv of [["--dryrun"], ["--persona", "x"], ["-n"]]) {
    assert.throws(() => checkFlags(argv, ["--dry-run", "--persona="]), ConfigError, `${argv.join(" ")} was accepted`);
  }
});

check("the prompt carries the contract's fixed points and names no other cookbook's source", async () => {
  const { contextSeedingPrompt } = await import(`../infra/agents/context-seeding.prompt.ts?contract=${stamp}`);
  for (const line of [
    "scripts/context-seeding/collect/jobs.ts",
    "Target market:", "Target personas:", "Key competitors:",
    "[R:", "[I:", "[TR:",
    "skip list", "Setup mode", "Questions for the reviewer",
    "## Company GTM Profile",
    "Never write to the workspace context repository directly",
  ]) assert.ok(contextSeedingPrompt.includes(line), `prompt lost: ${line}`);
  for (const word of ["call-capture", "crm-context", "hubspot", "cadence/log/calls", "postMessage"]) {
    assert.ok(!contextSeedingPrompt.toLowerCase().includes(word.toLowerCase()), `prompt mentions ${word}: this cookbook reads the public surface and nothing else`);
  }
});

let failed = 0;
for (const [name, run] of checks) {
  try { await run(); console.log(`ok   ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}\n     ${error.message.split("\n").join("\n     ")}`); }
}
if (failed > 0) { console.error(`${failed} contract check(s) failed`); process.exit(1); }
console.log(`${checks.length} contract checks passed`);
