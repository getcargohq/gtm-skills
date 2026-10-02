/**
 * What has to hold about this cookbook, checked on every run of
 * `npm run validate` (scripts/check-pipelines.mjs executes this file).
 *
 * Two halves. The registry half checks the compiled resources for the
 * boundaries CDK schema validation cannot express: one harness agent on a
 * monthly cron, the Slack channel locked on the use, no connector for a
 * system this cookbook must not read. The script half checks the audit's
 * invariants against canned data with no network: the aggregation, the
 * denominators, the mode line, the CRM registry.
 *
 * Run it from the skill folder after every adaptation:
 *   node --import tsx evals/contract.mjs
 */
import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
const stamp = Date.now();
await import(`../infra/agents/win-loss-analyst.ts?contract=${stamp}`);
await import(`../infra/connectors/git.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));
const checks = [];
const check = (name, run) => checks.push([name, run]);

check("the three connectors exist and bind, never create", () => {
  for (const [id, integration] of [
    ["connector:github", "github"],
    ["connector:anthropic", "anthropic"],
    ["connector:slack", "slack"],
  ]) {
    const connector = byId.get(id);
    assert.ok(connector, `${id} must exist`);
    assert.equal(connector.spec.integrationSlug, integration);
    assert.equal(connector.spec.config, undefined, `${id} must bind the workspace's connection, not declare a config`);
  }
});

check("no CRM connector resource, and no connector to a source this cookbook must not read", () => {
  for (const connector of resources().filter((r) => r.id.startsWith("connector:"))) {
    assert.ok(
      !["hubspot", "salesforce", "attio", "theirStack"].includes(connector.spec.integrationSlug),
      `${connector.id} binds ${connector.spec.integrationSlug}: the CRM is resolved at run time by the audit so a workspace without one still deploys, and postings are another cookbook's source`,
    );
  }
});

check("no defineContext and no model", () => {
  for (const id of byId.keys()) {
    assert.ok(!id.startsWith("context:"), `${id} would collide with the scaffold's`);
    assert.ok(!id.startsWith("model:"), `${id}: this cookbook reads the CRM through the audit script, not through an extract`);
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
  assert.equal((Array.isArray(env) ? env : Object.keys(env)).length, 0, "no env: choices live in scripts/crm-context/collect/config.ts and there is no credential");
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

check("the CRM registry key equals the adapter's integration", async () => {
  const { CRMS } = await import("../scripts/collect/crms/index.ts");
  for (const [slug, entry] of Object.entries(CRMS)) {
    assert.equal(entry.crm.integration, slug, `${slug} is filed under an adapter whose integration is "${entry.crm.integration}"`);
    assert.ok(["live", "docs"].includes(entry.written));
    for (const method of ["closedDeals", "companies", "contactsOnDeal"]) {
      assert.equal(typeof entry.crm[method], "function", `${slug} does not satisfy Crm: ${method} is missing`);
    }
  }
});

const deal = (id, outcome, extra = {}) => ({
  id, name: `deal ${id}`, pipeline: "default", stage: outcome === "won" ? "closedwon" : "closedlost", outcome,
  closedAt: "2026-06-01T00:00:00Z", dealType: null, lostReason: null, contactCount: null, companyId: null, ...extra,
});

check("the snapshot aggregates counts with denominators, lists pipelines, and diffs the previous run", async () => {
  const { buildSnapshot } = await import("../scripts/collect/audit.ts");
  const deals = [
    deal("w1", "won", { contactCount: 3, companyId: "c1" }),
    deal("w2", "won", { contactCount: 1, companyId: "c1" }),
    deal("l1", "lost", { contactCount: 0, lostReason: "price", pipeline: "partners" }),
    deal("l2", "lost", { contactCount: 2, lostReason: "price" }),
    deal("l3", "lost", { contactCount: null }),
  ];
  const snapshot = buildSnapshot({
    crm: { integration: "hubspot", connectorSlug: "hubspot", connectorUuid: "u" },
    window: { from: "2025-09-29", to: "2026-09-29", days: 365 },
    deals,
    companies: [{ id: "c1", name: "Acme", domain: "acme.example", industry: null, employees: 120, country: "FR", revenue: null }],
    wonDealContacts: [
      { dealId: "w1", contacts: [{ id: "p1", title: "VP Sales" }, { id: "p2", title: "VP Sales" }, { id: "p3", title: "CFO" }] },
      { dealId: "w2", contacts: [{ id: "p4", title: "VP Sales" }] },
    ],
    previous: { path: "cadence/log/raw/crm/2026-08-29.json", deals: [deal("w1", "won")] },
    now: "2026-09-29T00:00:00Z",
  });
  assert.equal(snapshot.mode, "hypothesis", "two wins is under the verify line");
  assert.deepEqual(snapshot.counts, { closed: 5, won: 2, lost: 3 });
  assert.deepEqual(snapshot.pipelines.map((p) => p.id), ["default", "partners"], "more than one pipeline is what the operator gets asked about");
  assert.deepEqual({ lost: snapshot.lostReason.lost, filled: snapshot.lostReason.filled }, { lost: 3, filled: 2 });
  assert.deepEqual(snapshot.lostReason.values, [{ value: "price", deals: 2 }]);
  assert.deepEqual(snapshot.association, { closed: 5, dealsWithContacts: 3 });
  assert.equal(snapshot.stakeholdersPerDeal.won.mean, 2);
  assert.equal(snapshot.stakeholdersPerDeal.lost.histogram["0"], 1, "a deal with no contacts is counted, a deal with an unknown count is not");
  assert.deepEqual(snapshot.titlesOnWonDeals, [{ title: "VP Sales", deals: 2 }, { title: "CFO", deals: 1 }], "a title counts once per deal however many people share it");
  assert.deepEqual(snapshot.companies[0], { id: "c1", name: "Acme", domain: "acme.example", industry: null, employees: 120, country: "FR", revenue: null, won: 2, lost: 0 });
  assert.deepEqual(snapshot.newSincePrevious, { previous: "cadence/log/raw/crm/2026-08-29.json", dealIds: ["w2", "l1", "l2", "l3"] });
  assert.ok(!JSON.stringify(snapshot).includes("@"), "no email address anywhere in the snapshot: it lives in a git repository");
  assert.ok(!/"(amount|currency)"/.test(JSON.stringify(snapshot)), "no deal amount anywhere in the snapshot: it lives in a git repository");
});

check("twenty wins in the window is verify mode", async () => {
  const { buildSnapshot } = await import("../scripts/collect/audit.ts");
  const deals = Array.from({ length: 20 }, (_, i) => deal(`w${i}`, "won"));
  const snapshot = buildSnapshot({
    crm: { integration: "hubspot", connectorSlug: "hubspot", connectorUuid: "u" },
    window: { from: "2025-09-29", to: "2026-09-29", days: 365 },
    deals, companies: [], wonDealContacts: [], previous: null,
  });
  assert.equal(snapshot.mode, "verify");
  assert.deepEqual(snapshot.newSincePrevious, { previous: null, dealIds: deals.map((d) => d.id) });
});

check("an argument the audit does not know stops the run", async () => {
  const { checkFlags, ConfigError } = await import("../scripts/collect/cli.ts");
  checkFlags(["--dry-run", "--crm=hubspot"], ["--dry-run", "--crm="]);
  for (const argv of [["--dryrun"], ["--crm", "hubspot"], ["-n"]]) {
    assert.throws(() => checkFlags(argv, ["--dry-run", "--crm="]), ConfigError, `${argv.join(" ")} was accepted`);
  }
});

check("the prompt carries the contract's fixed points and names no other cookbook's source", async () => {
  const { winLossAnalystPrompt } = await import(`../infra/agents/win-loss-analyst.prompt.ts?contract=${stamp}`);
  for (const line of [
    "scripts/crm-context/collect/crm.ts",
    "Lost reason filled on", "Contacts on <n> of <closed> closed deals",
    "[R:", "[I:", "[TR:",
    "Never edit a file under persona/", "never edit icp/ after the first pass",
    "Exactly five lines", "slack.postMessage",
    "workspace context repository directly",
  ]) assert.ok(winLossAnalystPrompt.toLowerCase().includes(line.toLowerCase()), `prompt lost: ${line}`);
  for (const word of ["call-capture", "context-seeding", "theirstack", "cadence/log/calls", "job posting"]) {
    assert.ok(!winLossAnalystPrompt.toLowerCase().includes(word), `prompt mentions ${word}: this cookbook reads the CRM and nothing else`);
  }
});

let failed = 0;
for (const [name, run] of checks) {
  try { await run(); console.log(`ok   ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}\n     ${error.message.split("\n").join("\n     ")}`); }
}
if (failed > 0) { console.error(`${failed} contract check(s) failed`); process.exit(1); }
console.log(`${checks.length} contract checks passed`);
