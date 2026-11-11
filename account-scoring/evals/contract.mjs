// What has to hold about this cookbook after an agent adapts it, checked
// against the compiled resources (the same loader `cargo-ai project check`,
// `plan` and `deploy` use) and against the arithmetic itself.
//
// Run it from the skill folder after every adaptation, and after every
// re-sync of the model:
//   node --import tsx evals/contract.mjs
// In a project, point it at the real model: SCORING_MD=context/icp/scoring.md
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadResources } from "@cargo-ai/cdk";

import { extractModelBlock, validateModel } from "../scripts/sync-model.mjs";

const infraDir = new URL("../infra", import.meta.url).pathname;
const scoringPath =
  process.env.SCORING_MD ??
  new URL("../context/scoring.md", import.meta.url).pathname;

const byId = new Map(
  (await loadResources(infraDir)).map((resource) => [resource.id, resource]),
);
const stamp = Date.now();
const { fitModel } = await import(`../infra/model.ts?contract=${stamp}`);
const { computeFit, buildProfile, readStoredValues } = await import(
  `../infra/compute/fit.ts?contract=${stamp}`
);
const { crmWriteback, firmographicColumns, rescoreAfter } = await import(
  `../infra/settings.ts?contract=${stamp}`
);
const { accountInput } = await import(
  `../infra/tools/enrich-account.ts?contract=${stamp}`
);

const checks = [];
const check = (name, run) => checks.push([name, run]);
const get = (id) => {
  const resource = byId.get(id);
  assert.ok(resource, `${id} must exist`);
  return resource;
};
const nodesOf = (id) => get(id).spec.nodes ?? [];
const only = (nodes, predicate, message) => {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, message);
  return matches[0];
};
const expression = (value) => JSON.stringify(value ?? "");

check("the resources are the two steps, the two plays and the four segments", () => {
  const expected = [
    "agent:account_scoring_agent",
    "connector:ai_ark",
    "connector:anthropic",
    "connector:linkedin",
    "connector:linkup",
    "folder:account_scoring_agents",
    "folder:account_scoring_models",
    "folder:account_scoring_plays",
    "folder:account_scoring_tools",
    "model:tam_companies",
    "play:rescore_accounts",
    "play:score_accounts",
    "segment:moderate_fit_accounts",
    "segment:no_fit_accounts",
    "segment:strong_fit_accounts",
    "segment:weak_fit_accounts",
    "tool:compute_fit",
    "tool:enrich_account",
    "tool:score_account",
  ];
  if (crmWriteback.crm !== "none") expected.push("connector:crm");
  assert.deepEqual([...byId.keys()].sort(), expected.sort());
});

check("model.ts is the json block of scoring.md, and the block is valid", () => {
  const block = extractModelBlock(readFileSync(scoringPath, "utf8"));
  assert.deepEqual(
    validateModel(block),
    [],
    "scoring.md breaks the model format (references/scoring-format.md)",
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(fitModel)),
    block,
    "infra/model.ts differs from scoring.md: run scripts/sync-model.mjs, then plan",
  );
});

check("the arithmetic: filters first, points, unknown at half, bands", () => {
  const best = {
    employees: 400,
    business_model: "marketplace",
    data_team_size: 25,
    realtime_personalization: "live",
    mobile_apps: "ios_and_android",
    warehouse: "snowflake",
  };
  const strong = computeFit(fitModel, best);
  assert.equal(strong.grade, "Strong");
  assert.equal(strong.score, 100, "the total is held at 100");

  const filtered = computeFit(fitModel, { ...best, employees: 30 });
  assert.equal(filtered.grade, "No Fit", "a filter that fires is No Fit, whatever the points");
  assert.match(filtered.filtered_by, /Employees/);

  const unknownSize = computeFit(fitModel, { ...best, employees: null });
  assert.notEqual(unknownSize.grade, "No Fit", "a filter never fires on unknown");

  const nothingKnown = computeFit(fitModel, {});
  const halves = fitModel.weights.reduce((sum, rule) => sum + rule.unknown, 0);
  assert.equal(nothingKnown.score, halves, "every unknown weight scores half");
  assert.equal(nothingKnown.unknown_count, fitModel.weights.length);

  const mid = computeFit(fitModel, { ...best, data_team_size: 8, warehouse: null });
  const lower = computeFit(fitModel, { ...best, data_team_size: 7, warehouse: null });
  assert.equal(mid.score - lower.score, 20, "8 meets the 8 range, 7 falls to the 0 range");

  const offList = computeFit(fitModel, { ...best, business_model: "something_else" });
  assert.match(offList.breakdown, /Business model: unknown/, "a label outside the list is unknown, not zero");

  assert.equal(computeFit(fitModel, best).grade, strong.grade, "same values, same grade");
});

check("every attribute has a producer in step 1", () => {
  const inputKeys = Object.keys(accountInput.shape);
  const enrich = nodesOf("tool:enrich_account");
  const research = only(
    enrich,
    (node) => node.kind === "connector" && node.actionSlug === "instruct",
    "one structured research call answers every research attribute",
  );
  const script = only(
    enrich,
    (node) => node.kind === "native" && node.actionSlug === "script",
    "one script node assembles the profile",
  );
  const call = script.config.script.slice(script.config.script.lastIndexOf("return assembleProfile("));
  for (const attribute of fitModel.attributes) {
    const where = `${attribute.slug} (${attribute.get.kind})`;
    if (attribute.get.kind === "firmographic") {
      const column = firmographicColumns[attribute.slug];
      assert.ok(column, `${where}: map it to a column in settings.ts firmographicColumns`);
      assert.ok(inputKeys.includes(column), `${where}: ${column} must be in the enrichment input`);
    } else if (attribute.get.kind === "provider") {
      assert.ok(
        call.includes(`${attribute.slug}: nodes.`),
        `${where}: wire a provider call for it in tools/enrich-account.ts and pass it to assembleProfile as ${attribute.slug}`,
      );
    } else {
      const property = research.config.structuredOutputSchema.properties[attribute.slug];
      assert.ok(property, `${where}: missing from the research schema`);
      assert.deepEqual(property.enum, [...attribute.values, "unknown"], `${where}: the research answer is limited to its values`);
    }
  }
});

check("step 1 collects and never writes; a failed provider is an unknown, not a failed run", () => {
  const enrich = nodesOf("tool:enrich_account");
  for (const node of enrich.filter((candidate) => candidate.kind === "connector")) {
    assert.equal(node.fallbackOnFailure, true, `${node.actionSlug} must run with continueOnFailure`);
  }
  assert.ok(
    !enrich.some((node) => node.kind === "native" && /^model/.test(node.actionSlug ?? "")),
    "the enrichment tool writes nothing: the play persists what it returns",
  );
  assert.ok(!enrich.some((node) => node.kind === "agent"), "step 1 is a tool, not an agent");
  const research = enrich.find((node) => node.actionSlug === "instruct");
  for (const rule of fitModel.weights)
    assert.ok(!expression(research.config.q).includes(`"weight"`), "the research question never carries a weight");
  assert.equal(research.config.depth, "standard", "recurring research stays on standard depth");
});

check("the profile writes bare slugs, one value and one evidence column per attribute", () => {
  const profile = buildProfile(fitModel, firmographicColumns, { employee_count: 120 }, { business_model: "marketplace", business_model_evidence: "https://example.com" }, { data_team_size: 12 });
  const slugs = profile.mappings.map((mapping) => mapping.columnSlug);
  assert.ok(slugs.every((slug) => !slug.startsWith("custom__")), "custom__ on the write drops the value while the node reports success");
  for (const attribute of fitModel.attributes) {
    assert.ok(slugs.includes(`fit_${attribute.slug}`) && slugs.includes(`fit_${attribute.slug}_evidence`));
  }
  assert.ok(slugs.includes("enriched_at"));
  const stored = readStoredValues(fitModel, Object.fromEntries(profile.mappings.map((m) => [`custom__${m.columnSlug}`, m.value])));
  assert.deepEqual(stored, profile.values, "what the rescore reads back is what the enrichment stored");
});

check("the model carries every column the steps write", () => {
  const columns = new Set((get("model:tam_companies").spec.additionalColumns ?? []).map((column) => column.slug));
  const required = [
    ...fitModel.attributes.flatMap((attribute) => [`fit_${attribute.slug}`, `fit_${attribute.slug}_evidence`]),
    "fit_grade", "fit_score", "fit_breakdown", "fit_reason", "fit_model_version", "enriched_at", "scored_at",
  ];
  for (const slug of required) assert.ok(columns.has(slug), `tam_companies must declare ${slug}`);
});

check("compute_fit is code only", () => {
  const kinds = nodesOf("tool:compute_fit").map((node) => `${node.kind}:${node.actionSlug ?? ""}`);
  assert.deepEqual(kinds, ["native:start", "native:script", "native:end"], "no agent, no connector: the same values always give the same grade");
});

check("the agent explains and cannot score, search or write", () => {
  const spec = get("agent:account_scoring_agent").spec;
  const capabilities = new Map((spec.capabilities ?? []).map((capability) => [capability.slug, capability]));
  assert.equal(capabilities.get("context")?.config?.isReadOnly, true, "it reads scoring.md from the context, read-only");
  assert.ok(!capabilities.has("webSearch"), "no search: it may only say what the grade was computed from");
  assert.ok(!capabilities.has("memory"), "each company is explained on its own");
  assert.deepEqual(spec.models ?? [], [], "no model in uses: it cannot write");
  assert.deepEqual(Object.keys(spec.output?.jsonSchema?.properties ?? {}), ["reason"], "its only output is the reason");
  assert.ok(spec.evaluator?.rubric, "the evaluator fails a reason that contradicts the grade");
});

check("score_account writes the computed grade, the reason and the stamp together", () => {
  const nodes = nodesOf("tool:score_account");
  const compute = only(nodes, (node) => node.kind === "tool", "one compute_fit call");
  const agent = only(nodes, (node) => node.kind === "agent", "one agent call");
  const write = only(nodes, (node) => node.kind === "native" && node.actionSlug === "modelCustomColumn", "one row write");
  assert.equal(write.config.modelUuid?.resourceId, "model:tam_companies");
  const mapping = Object.fromEntries(write.config.mappings.map((m) => [m.columnSlug, expression(m.value)]));
  for (const slug of ["fit_grade", "fit_score", "fit_breakdown", "fit_model_version"])
    assert.ok(mapping[slug]?.includes(`nodes.${compute.slug}.`), `${slug} comes from compute_fit, never from the agent`);
  assert.ok(mapping.fit_reason?.includes(`nodes.${agent.slug}.answer.reason`), "the agent's answer reaches the reason column only");
  assert.ok(mapping.scored_at, "the stamp is on the same write as the grade");
  const crmWrites = nodes.filter((node) => node.kind === "connector");
  if (crmWriteback.crm === "none") {
    assert.equal(crmWrites.length, 0, "no CRM write when crmWriteback is none");
  } else {
    const update = only(crmWrites, (node) => node.actionSlug === "updateRecords", "the CRM is updated, never upserted");
    assert.equal(update.config.isFailingOnMultipleMatches, true, "a domain matching two CRM companies writes to neither");
  }
});

check("the scoring play enriches then scores, on the stamp, disabled", () => {
  const play = get("play:score_accounts").spec;
  assert.equal(play.isEnabled, false, "ships disabled: pilot ten rows first");
  assert.deepEqual(play.changeKinds, ["added"], "runs for rows entering the filter, not every row every tick");
  assert.equal(play.runCreationRule, "noConcurrency");
  const conditions = play.filter.groups.flatMap((group) => group.conditions);
  assert.ok(conditions.every((condition) => condition.columnSlug === "custom__scored_at"), "eligibility is the stamp, never the grade");
  assert.ok(conditions.some((condition) => condition.operator === "lowerThan" && condition.value === rescoreAfter));
  const tools = play.nodes.filter((node) => node.kind === "tool").map((node) => node.toolUuid?.resourceId);
  assert.deepEqual(tools, ["tool:enrich_account", "tool:score_account"], "step 1, then step 2");
});

check("the rescore play pays for no enrichment", () => {
  const play = get("play:rescore_accounts").spec;
  assert.equal(play.isEnabled, false, "a model change is piloted on ten rows before the book is regraded");
  assert.ok(!play.nodes.some((node) => node.kind === "connector"), "no provider call on a rescore");
  assert.deepEqual(play.nodes.filter((node) => node.kind === "tool").map((node) => node.toolUuid?.resourceId), ["tool:score_account"]);
  const version = play.filter.groups.flatMap((group) => group.conditions).find((condition) => condition.columnSlug === "custom__fit_model_version");
  assert.equal(version?.value, fitModel.model_version, "it picks rows graded with an older model version");
});

check("every grade the code can compute has a segment", () => {
  const grades = ["Strong", "Moderate", "Weak", "No Fit"];
  const segmented = [...byId.values()]
    .filter((resource) => resource.id.startsWith("segment:"))
    .flatMap((resource) => resource.spec.filter.groups.flatMap((group) => group.conditions))
    .flatMap((condition) => condition.values ?? []);
  assert.deepEqual(segmented.sort(), grades.sort());
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
