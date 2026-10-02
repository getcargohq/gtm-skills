/**
 * What has to hold about this cookbook, checked on every run of
 * `npm run validate` (scripts/check-pipelines.mjs executes this file).
 *
 * Two halves. The registry half checks the compiled resources for the
 * boundaries CDK schema validation cannot express: one harness agent on a
 * weekly cron, nothing on `uses`, no capability, nothing deployed that bills,
 * and no connector for a system this cookbook must not read. The script half
 * checks the collector's invariants against canned data with no network: the
 * domain guard, the page text, and the diff against the previous snapshot.
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
  assert.equal((Array.isArray(env) ? env : Object.keys(env)).length, 0, "no env: the config is in scripts/, and there is no credential");
});

check("scripts/package.json keeps the CDK loader out of the collector", () => {
  assert.ok(existsSync(new URL("../scripts/package.json", import.meta.url)), "without it, cdk plan runs the news search");
});

check("the domain guard refuses the placeholder and normalizes a real domain", async () => {
  const { resolveDomain } = await import("../scripts/collect/snapshot.ts");
  const { DOMAIN } = await import("../scripts/collect/config.ts");
  assert.ok("error" in resolveDomain(undefined, DOMAIN), "the shipped config must not run");
  assert.deepEqual(resolveDomain("https://www.Acme.com/about", DOMAIN), { domain: "acme.com" });
  assert.ok("error" in resolveDomain("not a domain", DOMAIN));
});

check("page text drops scripts and styles and is stable", async () => {
  const { htmlToText } = await import("../scripts/collect/snapshot.ts");
  const html = "<html><head><title>Acme &amp; Co</title><style>p{}</style></head><body><script>track()</script><h1>We sell X</h1><p>To Y teams.</p></body></html>";
  const page = htmlToText(html, 1000);
  assert.equal(page.title, "Acme & Co");
  assert.equal(page.text, "Acme & Co We sell X\nTo Y teams.");
  assert.deepEqual(htmlToText(html, 1000), page, "the same page must read the same, or every week is a change");
  assert.equal(htmlToText(html, 5).text.length, 5, "text is capped");
});

check("the first run lists no changes; later runs diff pages and news", async () => {
  const { buildSnapshot, sha256 } = await import("../scripts/collect/snapshot.ts");
  const page = (url, text, status = "ok") => ({ url, status, via: status === "ok" ? "fetch" : null, title: null, hash: status === "ok" ? sha256(text) : null, text });
  const window = { from: "2026-09-01", to: "2026-09-07", days: 6 };
  const first = buildSnapshot({
    domain: "acme.com", window,
    pages: [page("https://acme.com", "home"), page("https://acme.com/pricing", "old pricing"), page("https://acme.com/blog", "blog")],
    news: [{ date: "2026-09-02", title: "Acme raises", url: "https://news.example/acme-raises", kind: "funding", summary: null }],
    previous: null, now: "2026-09-07T06:00:00Z",
  });
  assert.equal(first.firstRun, true);
  assert.deepEqual(first.changes, { previous: null, pagesAdded: [], pagesRemoved: [], pagesChanged: [], newsNew: ["https://news.example/acme-raises"] });

  const second = buildSnapshot({
    domain: "acme.com", window: { from: "2026-09-07", to: "2026-09-14", days: 7 },
    pages: [
      page("https://acme.com", "home"),
      page("https://acme.com/pricing", "new pricing"),
      page("https://acme.com/blog", "", "error"),
      page("https://acme.com/changelog", "", "missing"),
      page("https://acme.com/customers", "customers"),
    ],
    news: [
      { date: "2026-09-02", title: "Acme raises", url: "https://www.news.example/acme-raises/?utm_source=x", kind: "funding", summary: null },
      { date: "2026-09-10", title: "Acme launches Z", url: "https://news.example/acme-z", kind: "launch", summary: null },
      { date: "2026-09-10", title: "Acme launches Z", url: "https://news.example/acme-z", kind: "launch", summary: null },
    ],
    previous: { path: "cadence/log/raw/web/2026-09-07.json", snapshot: first }, now: "2026-09-14T06:00:00Z",
  });
  assert.equal(second.firstRun, false);
  assert.deepEqual(second.changes.pagesChanged, ["acme.com/pricing"]);
  assert.deepEqual(second.changes.pagesAdded, ["acme.com/customers"]);
  assert.deepEqual(second.changes.pagesRemoved, ["acme.com/blog"], "a page that stopped answering is removed; a page that never existed is not");
  assert.deepEqual(second.changes.newsNew, ["https://news.example/acme-z"], "a story seen last week is not new, whatever its tracking query");
  assert.equal(second.news.length, 2, "the same story twice is one item");
});

check("action outputs are read defensively", async () => {
  const { readNews, readExtract } = await import("../scripts/collect/snapshot.ts");
  assert.deepEqual(readNews({ output: { content: { items: [{ title: "A", url: "https://a.example", date: "2026-09-01" }, { title: "", url: "https://b.example" }] } } }).map((n) => n.url), ["https://a.example"]);
  assert.deepEqual(readNews({ unexpected: true }), [], "an unknown shape yields nothing, not a crash");
  assert.equal(readExtract({ results: [{ url: "https://a.example", excerpts: ["one", "two"] }] }), "one\ntwo");
  assert.equal(readExtract({ results: [{ url: "https://a.example", full_content: "all of it" }] }), "all of it");
});

check("an argument the collector does not know stops the run", async () => {
  const { checkFlags, ConfigError } = await import("../scripts/collect/cli.ts");
  checkFlags(["--dry-run", "--domain=acme.com"], ["--dry-run", "--domain="]);
  for (const argv of [["--dryrun"], ["--domain", "acme.com"], ["-n"]]) {
    assert.throws(() => checkFlags(argv, ["--dry-run", "--domain="]), ConfigError, `${argv.join(" ")} was accepted`);
  }
});

check("the prompt carries the contract's fixed points and reads only the web", async () => {
  const { webScribePrompt } = await import("../infra/agents/web-scribe.prompt.ts");
  for (const line of [
    "npx tsx scripts/web-capture/collect/web.ts",
    "[R:", "[I:", "[TR:",
    "you never edit, rename or delete an existing file",
    "insight/<today>-web.md",
    "always opens a pull request",
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
