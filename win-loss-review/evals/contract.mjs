/**
 * What has to hold about this cookbook, checked on every run of
 * `npm run validate` (scripts/check-pipelines.mjs executes this file).
 *
 * Three parts. The registry checks the compiled resources for the boundaries
 * schema validation cannot express: one harness agent on a monthly cron
 * with the Slack channel locked, the CRM models it reads, and no connector
 * for a system this cookbook must not read. The models check that every
 * model pulls all the data, with no filter in its config, and that the
 * shared CRM models are declared exactly as the other CRM cookbooks declare
 * them. The audit checks the SQL in the prompt: read-only, over the three
 * models, narrowed to closed deals, no amount, no email.
 *
 * Run it from the skill folder after every adaptation:
 *   node --import tsx evals/contract.mjs
 *
 * It loads through `loadResources`, the same loader `cargo-ai project check`,
 * `plan`, and `deploy` use, so what is asserted here is what would deploy.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { loadResources } from "@cargo-ai/cdk";

const infraDir = new URL("../infra", import.meta.url).pathname;
const byId = new Map(
  (await loadResources(infraDir)).map((resource) => [resource.id, resource]),
);
const checks = [];
const check = (name, run) => checks.push([name, run]);

check("the template declares one agent, four bound connectors, three models and two folders", () => {
  assert.deepEqual(
    [...byId.keys()].sort(),
    [
      "agent:win_loss_analyst",
      "connector:anthropic",
      "connector:crm",
      "connector:github",
      "connector:slack",
      "folder:win_loss_review_agents",
      "folder:win_loss_review_models",
      "model:crm_accounts",
      "model:crm_contacts",
      "model:crm_deals",
    ],
  );
  for (const id of ["connector:anthropic", "connector:crm", "connector:github", "connector:slack"]) {
    assert.equal(byId.get(id).spec.config, undefined, `${id} must bind the workspace's connection, not declare a config`);
  }
  assert.equal(byId.get("connector:crm").spec.integrationSlug, "hubspot", "HubSpot is the checked example");
});

check("there is no collector script: the platform extracts, the prompt queries", () => {
  assert.ok(!existsSync(new URL("../scripts", import.meta.url)), "scripts/ came back: the audit lives in the prompt's SQL");
});

check("every model pulls all the data: no filter and no column picking in the config", () => {
  for (const id of ["model:crm_deals", "model:crm_accounts", "model:crm_contacts"]) {
    const { config } = byId.get(id).spec;
    assert.equal(config.filter, undefined, `${id} filters in its config: pull everything and narrow in the SQL`);
    assert.equal(config.columnSelectionMode, "all", `${id} picks columns: pull everything and select in the SQL`);
  }
  assert.equal(byId.get("model:crm_deals").spec.config.objectType, "deals");
});

check("every query on deals narrows to closed deals itself", async () => {
  const { QUERIES } = await import("../infra/agents/win-loss-analyst.prompt.ts");
  for (const [name, sql] of Object.entries(QUERIES)) {
    if (!sql.includes("crm.crm_deals")) continue;
    assert.ok(
      sql.includes("(d.hs_is_closed_won = 'true' OR d.hs_is_closed_lost = 'true')"),
      `${name} reads deals without the closed condition: the model holds open deals, whose closedate is a forecast`,
    );
  }
});

check("the shared CRM models are declared exactly as the other CRM cookbooks declare them", () => {
  for (const [id, objectType] of [["model:crm_accounts", "companies"], ["model:crm_contacts", "contacts"]]) {
    const model = byId.get(id);
    assert.equal(model.spec.extractorSlug, "fetchRecords");
    assert.deepEqual(model.spec.config, { objectType, columnSelectionMode: "all" }, `${id} must match crm-enrichment's and crm-deduplication's, so one copy serves all three`);
  }
});

check("the audit is read-only SQL over the three models, with no amount and no email", async () => {
  const { QUERIES, winLossAnalystPrompt } = await import("../infra/agents/win-loss-analyst.prompt.ts");
  assert.ok(Object.keys(QUERIES).length >= 6, "the audit lost queries");
  for (const [name, sql] of Object.entries(QUERIES)) {
    assert.match(sql, /^SELECT /, `${name} must be a SELECT`);
    assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i.test(sql), `${name} must not write`);
    for (const ref of sql.match(/\b(?:FROM|JOIN)\s+([a-z_.]+)/gi) ?? []) {
      assert.match(ref, /crm\.crm_(deals|accounts|contacts)$/, `${name} reads ${ref}: only the three models`);
    }
    assert.ok(!/amount|email/i.test(sql), `${name} reads money or an email`);
    assert.ok(!sql.includes('"'), `${name} holds a double quote, which breaks the shell command it is wrapped in`);
    assert.ok(winLossAnalystPrompt.includes(`cargo-ai storage query execute "${sql}"`), `${name} is not in the prompt as a command`);
  }
  for (const name of ["pipelines", "lost_reasons", "contacts_on_deals", "deals_since"]) {
    assert.ok(QUERIES[name], `the ${name} query is what a hygiene finding or a receipt reads`);
  }
});

check("exactly one agent deploys, a harness on a monthly cron with the channel locked", () => {
  const agents = [...byId.keys()].filter((id) => id.startsWith("agent:"));
  assert.deepEqual(agents, ["agent:win_loss_analyst"], "one cookbook, one use case, one agent");
  const agent = byId.get("agent:win_loss_analyst");
  assert.equal(agent.spec.harnessSlug, "claudeCode", "its output is a repo diff");
  assert.ok(agent.spec.connectorUuid, "the harness does not bring its own model");
  assert.equal(typeof agent.spec.languageModelSlug, "string", "it must name a languageModel");
  assert.equal(byId.get("connector:anthropic").spec.integrationSlug, "anthropic", "claudeCode is proxied to Anthropic");
  assert.equal((agent.spec.capabilities ?? []).length, 0, "a context capability would be a write path that skips the pull request");
  assert.equal((agent.spec.tools ?? []).length, 0, "slack.postMessage is an action on the agent, not a wrapped tool");
  const env = agent.spec.repository?.env ?? [];
  assert.equal((Array.isArray(env) ? env : Object.keys(env)).length, 0, "no env: the audit is in the prompt and there is no credential");
  const crons = (agent.spec.triggers ?? []).filter((t) => t.type === "cron");
  assert.equal(crons.length, 1, "exactly one cron trigger");
  assert.match(crons[0].cron, /^\S+ \S+ \d+ \* \*$/, "the cron is monthly: a day-of-month, every month");
  const posts = (agent.spec.connectorActions ?? []).filter((a) => a.integration === "slack" && a.actionSlug === "postMessage");
  assert.equal(posts.length, 1, "the agent must use slack.postMessage once");
  const [post] = posts;
  assert.equal(typeof post.config?.channelId, "string", "channelId must be locked on the use, not left for the agent to pick");
  assert.notEqual(post.config.channelId, "", "channelId must not be empty");
  assert.equal(post.config.format, "markdown", "format must be locked to markdown");
  assert.equal(post.config.disableUnfurling, true, "disableUnfurling must be locked so the PR link stays a link");
});

check("the prompt carries the contract's fixed points and names no other cookbook's source", async () => {
  const { winLossAnalystPrompt } = await import("../infra/agents/win-loss-analyst.prompt.ts");
  for (const line of [
    "do not improvise this step",
    "never run a query that is not in step 1",
    "Lost reason filled on", "Contacts on <n> of <closed> closed deals",
    "[R:", "[I:", "[TR:",
    "Never edit a file under persona/", "never edit icp/ after the first pass",
    "Exactly five lines", "slack.postMessage",
    "workspace context repository directly",
  ]) assert.ok(winLossAnalystPrompt.toLowerCase().includes(line.toLowerCase()), `prompt lost: ${line}`);
  for (const word of ["call-capture", "web-capture", "theirstack", "cadence/log/calls", "job posting"]) {
    assert.ok(!winLossAnalystPrompt.toLowerCase().includes(word), `prompt mentions ${word}: this cookbook reads the CRM and nothing else`);
  }
});

check("the monthly agent never writes the scoring model", async () => {
  const { winLossAnalystPrompt } = await import("../infra/agents/win-loss-analyst.prompt.ts");
  assert.ok(
    winLossAnalystPrompt.includes("never write context/icp/scoring.md"),
    "the prompt lost the rule: scoring.md is rebuilt only by a scoring pass, with a person at every stop",
  );
});

check("the scoring pass carries its fixed points", () => {
  const read = (file) => readFileSync(new URL(`../references/${file}`, import.meta.url), "utf8");
  const pass = read("scoring-pass.md");
  for (const line of [
    "Internal data defines what great looks like; it never scores",
    "Contract value alone never decides",
    "Tier 1 against Tier 2",
    "it held in the period before",
    "Missing is not \"no\"",
    "Test on 10 accounts first",
    "never told whether the account is Tier 1",
    "-win-loss-scoring",
    "never merge the pull request",
    "Hand off to account-scoring",
  ]) assert.ok(pass.includes(line), `scoring-pass.md lost: ${line}`);
  assert.ok(!pass.includes("outputs/<today>-win-loss-review/"), "the scoring pass must not write the monthly run's directory: the monthly agent reads it as its next <since>");
  const format = read("scoring-format.md");
  for (const line of ["Weights sum to 100", "Unknown is neutral", "Code computes", "Outside-visible only"]) {
    assert.ok(format.includes(line), `scoring-format.md lost: ${line}`);
  }
  const research = read("custom-attributes.md");
  for (const line of ["{{domain}}", "Assume the goal is net-new prospecting", "First-party only"]) {
    assert.ok(research.includes(line), `custom-attributes.md lost: ${line}`);
  }
});

check("the model block in scoring-format.md is internally consistent", () => {
  const format = readFileSync(new URL("../references/scoring-format.md", import.meta.url), "utf8");
  const block = format.match(/```json\n([\s\S]*?)\n```/)?.[1];
  assert.ok(block, "scoring-format.md lost its json model block");
  const model = JSON.parse(block);
  const slugs = new Set(model.attributes.map((attribute) => attribute.slug));
  for (const attribute of model.attributes) {
    assert.ok(["firmographic", "provider", "research"].includes(attribute.get?.kind), `${attribute.slug}: get.kind`);
    if (attribute.get.kind === "research") assert.equal(attribute.type, "enum", `${attribute.slug}: research attributes are enums`);
  }
  for (const rule of [...model.filters, ...model.weights, ...model.modifiers])
    assert.ok(slugs.has(rule.attribute), `${rule.attribute} is scored but never declared as an attribute`);
  assert.equal(model.weights.reduce((sum, rule) => sum + rule.weight, 0), 100, "the example's weights must sum to 100");
  for (const rule of model.weights) {
    const best = Math.max(...(rule.points ? Object.values(rule.points) : rule.ranges.map((range) => range.points)));
    assert.equal(best, rule.weight, `${rule.attribute}: its best value scores its weight`);
    assert.equal(rule.unknown, Math.floor(rule.weight / 2), `${rule.attribute}: unknown is half the weight, rounded down`);
  }
});

let failed = 0;
for (const [name, run] of checks) {
  try { await run(); console.log(`ok   ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}\n     ${error.message.split("\n").join("\n     ")}`); }
}
if (failed > 0) { console.error(`${failed} contract check(s) failed`); process.exit(1); }
console.log(`${checks.length} contract checks passed`);
