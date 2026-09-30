/**
 * What has to hold about this cookbook, checked on every run of
 * `npm run validate` (scripts/check-pipelines.mjs executes this file).
 *
 * Two halves. The registry half checks the compiled resources for the
 * boundaries CDK schema validation cannot express: which agents are harness
 * agents, that nothing deploys a persona model by default, that the refresh
 * has its channel locked and the bootstrap has no trigger. The script half
 * checks the collectors' invariants against canned data with no network:
 * the budget rule, the snapshot aggregation, the mode line, the CRM registry.
 *
 * Run it from the skill folder after every adaptation:
 *   node --import tsx evals/contract.mjs
 */
import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
const stamp = Date.now();
await import(`../infra/agents/context-bootstrap.ts?contract=${stamp}`);
await import(`../infra/agents/context-refresh.ts?contract=${stamp}`);
await import(`../infra/agents/gtm-analyst.ts?contract=${stamp}`);
await import(`../infra/connectors/git.ts?contract=${stamp}`);
await import(`../infra/connectors/theirstack.ts?contract=${stamp}`);
await import(`../infra/models/persona-jobs.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));
const checks = [];
const check = (name, run) => checks.push([name, run]);

// ---------------------------------------------------------------- connectors

check("the four connectors exist and bind, never create", () => {
  for (const [id, integration] of [
    ["connector:github", "github"],
    ["connector:slack", "slack"],
    ["connector:anthropic", "anthropic"],
    ["connector:their_stack", "theirStack"],
  ]) {
    const connector = byId.get(id);
    assert.ok(connector, `${id} must exist`);
    assert.equal(connector.spec.integrationSlug, integration);
    assert.equal(
      connector.spec.config,
      undefined,
      `${id} must bind the workspace's connection, not declare a config`,
    );
  }
});

check("no defineContext: the project's own root context/ is the singleton", () => {
  for (const id of byId.keys()) {
    assert.ok(!id.startsWith("context:"), `${id} would collide with the scaffold's`);
  }
});

// ------------------------------------------------------------------- harness

const harnessAgent = (id) => {
  const agent = byId.get(id);
  assert.ok(agent, `${id} must exist`);
  assert.equal(agent.spec.harnessSlug, "claudeCode", `${id} must be a Claude Code harness agent: its output is a repo diff`);
  assert.ok(agent.spec.connectorUuid, `${id} must bind the LLM connector: the harness does not bring its own model`);
  assert.equal(typeof agent.spec.languageModelSlug, "string", `${id} must name a languageModel`);
  assert.equal((agent.spec.capabilities ?? []).length, 0, `${id} needs no capability: a context capability would be a write path that skips the pull request`);
  assert.equal((agent.spec.tools ?? []).length, 0, `${id} must not wrap an action in a tool`);
  const env = agent.spec.repository?.env ?? [];
  assert.equal((Array.isArray(env) ? env : Object.keys(env)).length, 0, `${id} declares no env: choices live in scripts/context-building/collect/config.ts and there is no credential`);
  return agent;
};

check("claudeCode is proxied to Anthropic", () => {
  assert.equal(byId.get("connector:anthropic").spec.integrationSlug, "anthropic", "an openAi connector deploys broken under claudeCode");
});

check("the bootstrap is a harness agent with no trigger and no actions", () => {
  const agent = harnessAgent("agent:context-bootstrap");
  assert.equal((agent.spec.triggers ?? []).length, 0, "the bootstrap runs once by hand: a cron would re-crawl monthly and ask nobody anything");
  assert.equal((agent.spec.connectorActions ?? []).length, 0, "the bootstrap posts nothing: its only output is the pull request");
});

check("the refresh is a harness agent on a monthly cron with the channel locked", () => {
  const agent = harnessAgent("agent:context-refresh");
  const crons = (agent.spec.triggers ?? []).filter((t) => t.type === "cron");
  assert.equal(crons.length, 1, "exactly one cron trigger");
  assert.match(crons[0].cron, /^\S+ \S+ \d+ \* \*$/, "the cron is monthly: a day-of-month, every month");
  const posts = (agent.spec.connectorActions ?? []).filter((a) => a.integration === "slack" && a.actionSlug === "postMessage");
  assert.equal(posts.length, 1, "the refresh must use slack.postMessage once");
  const [post] = posts;
  assert.equal(typeof post.config?.channelId, "string", "channelId must be locked on the use, not left for the agent to pick");
  assert.notEqual(post.config.channelId, "", "channelId must not be empty");
  assert.equal(post.config.format, "markdown", "format must be locked to markdown");
  assert.equal(post.config.disableUnfurling, true, "disableUnfurling must be locked so the PR link stays a link");
});

check("the analyst reads context read-only and is triggered from listed Slack channels", () => {
  const agent = byId.get("agent:gtm-analyst");
  assert.ok(agent, "defineAgent(gtm-analyst) must exist");
  assert.notEqual(agent.spec.harnessSlug, "claudeCode", "the analyst needs no working tree");
  const context = (agent.spec.capabilities ?? []).find((c) => c.slug === "context");
  assert.ok(context, "the analyst must have the context capability, or it answers from nothing");
  assert.equal(context.config?.isReadOnly, true, "the analyst's context capability must be read-only: the pull request is the only write path");
  const triggers = (agent.spec.triggers ?? []).filter((t) => t.type === "connector" && t.integration === "slack");
  assert.equal(triggers.length, 1, "exactly one Slack trigger");
  const ids = triggers[0].config?.channelIds ?? [];
  assert.ok(ids.length > 0 && triggers[0].config?.allChannels !== true, "list channels; an analyst on every channel quotes the objection file to a customer");
  for (const id of ids) assert.match(id, /^[CGU][A-Z0-9]+$/, `${id} is not a Slack id`);
});

// -------------------------------------------------------------------- models

check("no persona model deploys by default", () => {
  const models = [...byId.keys()].filter((id) => id.startsWith("model:"));
  assert.deepEqual(models, [], `a model here bills its first pull at deploy before any persona is confirmed: ${models.join(", ")}`);
});

check("the model builder and the collector ask TheirStack the same question", async () => {
  const { personaJobsModel, personaPullConfig } = await import(`../infra/models/persona-jobs.ts?contract=${stamp}`);
  const { pullConfig } = await import("../scripts/collect/personas.ts");
  const pull = {
    slug: "probe",
    titles: ["Head of Probes"],
    exclude: ["intern"],
    band: { min: 20, max: 200 },
    limit: 7,
  };
  assert.deepEqual(personaPullConfig(pull), pullConfig(pull), "infra/models/persona-jobs.ts and scripts/collect/personas.ts must build byte-identical configs");
  const config = pullConfig(pull);
  assert.equal(config.companyFields.min_employee_count, 20);
  assert.equal(config.companyFields.max_employee_count, 200);
  assert.equal(config.companyFields.company_type, "direct_employer");
  assert.equal(config.limit, 7, "limit is the budget: billing is per returned posting");

  const before = resources().length;
  const handle = personaJobsModel(pull);
  assert.equal(handle.slug, "persona_jobs_probe");
  const model = byId.get("model:persona_jobs_probe") ?? resources().find((r) => r.id === "model:persona_jobs_probe");
  assert.ok(model, "the builder registers a model");
  assert.equal(model.spec.extractorSlug, "fetchJobs");
  assert.equal(model.spec.schedule, undefined, "no schedule by default");
  assert.equal(resources().length, before + 1);
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

// -------------------------------------------------------------------- budget

check("the budget rule sizes the pull to the balance and refuses a pull that cannot saturate", async () => {
  const { personaPullBudget } = await import("../scripts/collect/budget.ts");
  // Own key: no credits, target per persona, extension allowed.
  let b = personaPullBudget({ balance: 0, unitPrice: 0.5, billsCredits: false, personas: 4 });
  assert.equal(b.limit, 40);
  assert.equal(b.extendTo, 80);
  assert.equal(b.spend, 0);
  // Free plan: 100 credits, half kept back, 0.5 per row, 4 personas: 25 each.
  b = personaPullBudget({ balance: 100, unitPrice: 0.5, billsCredits: true, personas: 4 });
  assert.equal(b.limit, 25);
  assert.equal(b.extendTo, 25, "no second batch when the share cannot fund it for every persona");
  assert.equal(b.spend, 50);
  // Too low to saturate: skip.
  b = personaPullBudget({ balance: 40, unitPrice: 0.5, billsCredits: true, personas: 4 });
  assert.equal(b.limit, 0);
  assert.equal(b.spend, 0);
  // Headroom: target with a second batch allowed.
  b = personaPullBudget({ balance: 5000, unitPrice: 0.5, billsCredits: true, personas: 4 });
  assert.equal(b.limit, 40);
  assert.equal(b.extendTo, 80);
  assert.equal(b.spend, 80);
  // No price: cannot size, refuse rather than guess.
  b = personaPullBudget({ balance: 5000, unitPrice: 0, billsCredits: true, personas: 4 });
  assert.equal(b.limit, 0);
});

// ---------------------------------------------------------------------- audit

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

check("the snapshot aggregates counts with denominators and sets the mode", async () => {
  const { buildSnapshot } = await import("../scripts/collect/audit.ts");
  const deal = (id, outcome, extra = {}) => ({
    id,
    name: `deal ${id}`,
    pipeline: "default",
    stage: outcome === "won" ? "closedwon" : "closedlost",
    outcome,
    closedAt: "2026-06-01T00:00:00Z",
    amount: null,
    currency: null,
    dealType: null,
    lostReason: null,
    contactCount: null,
    companyId: null,
    ...extra,
  });
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
    companies: [{ id: "c1", name: "Acme", domain: "acme.com", industry: null, employees: 120, country: "FR", revenue: null }],
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
  assert.equal(snapshot.stakeholdersPerDeal.lost.deals, 3);
  assert.equal(snapshot.stakeholdersPerDeal.lost.histogram["0"], 1, "a deal with no contacts is counted, a deal with an unknown count is not");
  // A title counts once per deal however many people share it.
  assert.deepEqual(snapshot.titlesOnWonDeals, [{ title: "VP Sales", deals: 2 }, { title: "CFO", deals: 1 }]);
  assert.deepEqual(snapshot.companies[0], { id: "c1", name: "Acme", domain: "acme.com", industry: null, employees: 120, country: "FR", revenue: null, won: 2, lost: 0 });
  assert.deepEqual(snapshot.newSincePrevious, { previous: "cadence/log/raw/crm/2026-08-29.json", dealIds: ["w2", "l1", "l2", "l3"] });
});

check("twenty wins in the window is verify mode", async () => {
  const { buildSnapshot } = await import("../scripts/collect/audit.ts");
  const deals = Array.from({ length: 20 }, (_, i) => ({
    id: `w${i}`, name: "", pipeline: "default", stage: "closedwon", outcome: "won", closedAt: "2026-01-01T00:00:00Z",
    amount: null, currency: null, dealType: null, lostReason: null, contactCount: null, companyId: null,
  }));
  const snapshot = buildSnapshot({
    crm: { integration: "hubspot", connectorSlug: "hubspot", connectorUuid: "u" },
    window: { from: "2025-09-29", to: "2026-09-29", days: 365 },
    deals, companies: [], wonDealContacts: [], previous: null,
  });
  assert.equal(snapshot.mode, "verify");
  assert.deepEqual(snapshot.newSincePrevious, { previous: null, dealIds: deals.map((d) => d.id) });
});

check("an argument the collectors do not know stops the run", async () => {
  const { checkFlags, ConfigError } = await import("../scripts/collect/cli.ts");
  checkFlags(["--dry-run", "--crm=hubspot"], ["--dry-run", "--crm="]);
  for (const argv of [["--dryrun"], ["--crm", "hubspot"], ["-n"]]) {
    assert.throws(() => checkFlags(argv, ["--dry-run", "--crm="]), ConfigError, `${argv.join(" ")} was accepted`);
  }
});

check("the prompts carry the contract's fixed points", async () => {
  const { contextBootstrapPrompt } = await import(`../infra/agents/context-bootstrap.prompt.ts?contract=${stamp}`);
  const { contextRefreshPrompt } = await import(`../infra/agents/context-refresh.prompt.ts?contract=${stamp}`);
  for (const line of [
    "scripts/context-building/collect/crm.ts",
    "scripts/context-building/collect/jobs.ts",
    "Target market:",
    "Target personas:",
    "Key competitors:",
    "[R:",
    "[I:",
    "[TR:",
    "skip list",
    "Lost reason filled on",
    "Contacts on <n> of <closed> closed deals",
    "## Company GTM Profile",
    "Never write to the workspace context repository directly",
  ]) {
    assert.ok(contextBootstrapPrompt.includes(line), `bootstrap prompt lost: ${line}`);
  }
  for (const line of [
    "scripts/context-building/collect/crm.ts",
    "Never edit a file under icp/ or persona/",
    "Exactly five lines",
    "slack.postMessage",
  ]) {
    assert.ok(contextRefreshPrompt.includes(line), `refresh prompt lost: ${line}`);
  }
});

let failed = 0;
for (const [name, run] of checks) {
  try {
    await run();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}\n     ${error.message.split("\n").join("\n     ")}`);
  }
}
if (failed > 0) {
  console.error(`${failed} contract check(s) failed`);
  process.exit(1);
}
console.log(`${checks.length} contract checks passed`);
