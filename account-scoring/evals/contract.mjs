import { parse } from "yaml";
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdtempSync,
  cpSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { resetRegistry, resources } from "@cargo-ai/cdk";

const here = dirname(fileURLToPath(import.meta.url));
const infra = process.env.ACCOUNT_SCORING_INFRA || resolve(here, "../infra");
const read = (path) => readFileSync(path, "utf8");
const context = process.env.ACCOUNT_SCORING_CONTEXT || join(infra, "context");
const f = parse(read(join(context, "account-fit-feature-contract.yaml")));
const c = parse(read(join(context, "account-fit-scoring.yaml")));
const bundle = await import(pathToFileURL(join(infra, "runtime/generated.ts")));
const source = read(join(infra, "runtime/scorer.py"));
assert.equal(
  bundle.sourceHash,
  createHash("sha256").update(source).digest("hex"),
);
assert.ok(bundle.scoringScript.startsWith(source));
assert.ok(bundle.normalizeScript.startsWith(source));
assert.equal(
  bundle.scoringContext,
  read(join(context, "account-fit-scoring.md")),
);
const renderedContracts = [
  ...bundle.scoringContext.matchAll(/```json\n([\s\S]*?)\n```/g),
].map((m) => JSON.parse(m[1]));
assert.deepEqual(renderedContracts, [f, c]);

resetRegistry();
await import(pathToFileURL(join(infra, "plays/score-accounts.ts")));
await import(pathToFileURL(join(infra, "segments/tiers.ts")));
const all = resources();
const get = (id) => {
  const r = all.find((r) => r.id === id);
  assert.ok(r, id);
  return r.spec;
};
const play = get("play:score-accounts"),
  tool = get("tool:compute-account-fit"),
  agent = get("agent:account-scorer"),
  model = get("model:accounts");
assert.equal(model.extractorSlug, "fetchRecords");
assert.equal(model.datasetUuid.resourceId, "connector:hubspot");
assert.equal(model.schedule, undefined);
assert.equal(play.isEnabled, false);
assert.equal(play.limit, 25);
assert.equal(play.runCreationRule, "noConcurrency");
assert.deepEqual(
  new Set(play.changeKinds),
  new Set(["added", "updated", "unchanged"]),
);
assert.equal(all.filter((r) => r.kind === "context").length, 0);
assert.ok(
  all.filter((r) => r.kind === "connector").every((r) => r.spec.adopt === true),
);
assert.equal(agent.output.jsonSchema.additionalProperties, false);
assert.deepEqual(Object.keys(agent.output.jsonSchema.properties), [
  "rationale",
]);
assert.ok(
  agent.capabilities.some((x) => x.slug === "context" && x.config.isReadOnly),
);
assert.ok(!agent.capabilities.some((x) => x.slug === "memory"));
assert.deepEqual(agent.models ?? [], []);
assert.ok(JSON.stringify(agent).includes("tool:compute-account-fit"));
assert.ok(!JSON.stringify(agent).includes("updateRecords"));
assert.equal(tool.nodes.filter((n) => n.actionSlug === "python").length, 1);
const conditions = play.filter.groups.flatMap((g) => g.conditions);
assert.ok(conditions.some((x) => x.kind === "date" && x.operator === "isNull"));
assert.ok(
  conditions.some((x) => x.kind === "date" && x.operator === "lowerThan"),
);
assert.ok(
  conditions.some(
    (x) =>
      x.columnSlug === "custom__fit_scoring_version" &&
      x.operator === "isNot" &&
      x.values[0] === bundle.scoringVersion,
  ),
);
const segments = all.filter((r) => r.kind === "segment");
assert.deepEqual(
  segments.map((r) => r.spec.filter.groups[0].conditions[0].values[0]).sort(),
  [...bundle.tierNames].sort(),
);
assert.ok(
  segments.every(
    (r) => r.spec.filter.groups[0].conditions[0].columnSlug === "cargo_tier",
  ),
);
const writes = play.nodes.filter(
  (n) => n.kind === "connector" && n.actionSlug === "updateRecords",
);
assert.equal(writes.length, 2);
assert.ok(
  writes.every(
    (n) =>
      n.config.matchingPropertyName === "hs_object_id" &&
      n.config.matchingValue.expression.includes("nodes.script.result.id"),
  ),
);
assert.ok(writes.every((n) => !n.fallbackOnFailure));
assert.ok(!play.nodes.some((n) => n.actionSlug === "getRecord"));
const numeric = writes[0].config.mappings.filter((m) =>
  ["cargo_score", "cargo_tier"].includes(m.propertyName),
);
assert.ok(numeric.every((m) => !m.value.expression.includes("nodes.agent")));
const declared = new Set(model.additionalColumns.map((c) => c.slug));
for (const n of play.nodes.filter(
  (n) => n.actionSlug === "modelCustomColumn",
)) {
  for (const m of n.config.mappings) {
    assert.ok(declared.has(m.columnSlug));
    assert.ok(!m.columnSlug.startsWith("custom__"));
  }
}

// Execute the compiled graph with synthetic services. This catches source-variable
// vs node-slug mistakes, Python wrapping/output drift, and bypassed failure guards.
const require = createRequire(import.meta.url);
const expression = (value, nodes) => {
  if (
    value &&
    typeof value === "object" &&
    value.kind === "templateExpression"
  ) {
    const text = value.expression;
    if (
      text.startsWith("{{ ") &&
      text.endsWith(" }}") &&
      text.indexOf("}}") === text.length - 2
    )
      return new Function("nodes", `return (${text.slice(3, -3)});`)(nodes);
    return text.replace(/\{\{ (.*?) \}\}/g, (_, expr) =>
      String(new Function("nodes", `return (${expr});`)(nodes)),
    );
  }
  if (Array.isArray(value)) return value.map((v) => expression(v, nodes));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, expression(v, nodes)]),
    );
  return value;
};
const python = (script, nodes) =>
  JSON.parse(
    execFileSync(
      "python3",
      [
        "-c",
        `import sys,json,asyncio\np=json.load(sys.stdin)\nns={'nodes':p['nodes']}\nexec('async def run():\\n'+''.join('    '+line+'\\n' for line in p['script'].splitlines()),ns)\nprint(json.dumps(asyncio.run(ns['run']()),allow_nan=False))`,
      ],
      { input: JSON.stringify({ script, nodes }), encoding: "utf8" },
    ),
  );
const liveF = structuredClone(f),
  liveC = structuredClone(c);
for (const x of [liveF, liveC]) {
  x.synthetic = false;
  x.approval = { state: "approved", reference: "offline-fixture-only" };
}
const liveScript = (s, features = liveF) =>
  s
    .replace(
      JSON.stringify(JSON.stringify(f)),
      JSON.stringify(JSON.stringify(features)),
    )
    .replace(
      JSON.stringify(JSON.stringify(c)),
      JSON.stringify(JSON.stringify(liveC)),
    );
const fixtureRow = (overrides = {}) => ({
  id: "fixture-id",
  numberofemployees: "100",
  hs_lastmodifieddate: new Date().toISOString(),
  ...overrides,
});
const evidence = (row) => ({
  account_id: row.id,
  feature_contract_version: f.version,
  features: Object.fromEntries(
    f.features
      .filter((x) => x.name !== "employee_count")
      .map((x) => [
        x.name,
        {
          value: x.name === "engineering_count" ? 35 : "cloud",
          as_of: row.hs_lastmodifieddate,
          source_or_evidence_reference: "fixture:evidence",
          snapshot_quality: "exact",
          extraction_version: x.extraction_version,
        },
      ]),
  ),
});
const stateFor = (options = {}) => ({
  local: {},
  crm: { id: "fixture-id", properties: { cargo_score: "55", cargo_tier: "B" } },
  writes: 0,
  agentCalls: 0,
  ...options,
});
function runGraph(graph, input, state, toolNodes = tool.nodes) {
  const nodes = { start: input };
  let node = graph.find((n) => n.actionSlug === "start");
  let steps = 0;
  while (node) {
    assert.ok(++steps < 80, "cycle in graph");
    const cfg = expression(node.config, nodes);
    let next = 0;
    if (node.actionSlug === "start") {
    } else if (node.actionSlug === "script")
      nodes[node.slug] = {
        result: new Function("nodes", "parentNodes", "require", cfg.script)(
          nodes,
          {},
          require,
        ),
      };
    else if (node.actionSlug === "python")
      nodes[node.slug] = {
        result: python(
          state.draft ? cfg.script : liveScript(cfg.script, state.features),
          nodes,
        ),
      };
    else if (node.kind === "tool") {
      nodes[node.slug] = runGraph(toolNodes, cfg, state, toolNodes);
      if (state.malformed) nodes[node.slug].score = "99";
      if (state.wrongTier) nodes[node.slug].tier = "invented";
      if (state.wrongVersion) nodes[node.slug].scoring_version = "unapproved";
    } else if (node.actionSlug === "branch") next = cfg.condition ? 0 : 1;
    else if (node.actionSlug === "modelCustomColumn") {
      if (
        state.failFinalModel &&
        cfg.mappings.some((m) => m.columnSlug === "fit_scored_at")
      )
        throw new Error("fixture final model failure");
      for (const m of cfg.mappings) state.local[m.columnSlug] = m.value;
      nodes[node.slug] = { custom: structuredClone(state.local) };
    } else if (node.kind === "agent") {
      state.agentCalls++;
      nodes[node.slug] = {
        answer: state.answer ?? {
          rationale:
            "An intentionally contradictory score of 1, tier C; the prose must not control numeric fields.",
        },
      };
    } else if (
      node.kind === "connector" &&
      node.actionSlug === "updateRecords"
    ) {
      if (
        state.failWrite ||
        (state.failStamp &&
          cfg.mappings.some((m) => m.propertyName === "cargo_last_updated_at"))
      )
        throw new Error("fixture CRM outage");
      state.writes++;
      if (state.emptyWrite) nodes[node.slug] = [];
      else {
        for (const m of cfg.mappings)
          state.crm.properties[m.propertyName] = String(m.value);
        nodes[node.slug] = [structuredClone(state.crm)];
        if (
          state.badReadback &&
          cfg.mappings.some((m) => m.propertyName === "cargo_score")
        )
          delete nodes[node.slug][0].properties.cargo_score;
        if (
          state.badStamp &&
          cfg.mappings.some((m) => m.propertyName === "cargo_last_updated_at")
        )
          nodes[node.slug][0].properties.cargo_last_updated_at = "bad-date";
      }
    } else if (node.kind === "connector" && node.actionSlug === "getRecord")
      nodes[node.slug] = structuredClone(state.crm);
    else if (node.actionSlug === "end")
      return Object.fromEntries(cfg.variables.map((v) => [v.name, v.value]));
    else throw new Error(`Unhandled fixture node ${node.slug}`);
    node = graph.find((n) => n.uuid === node.childrenUuids[next]);
  }
  throw new Error("Missing end node");
}
const row = fixtureRow();
row.custom__fit_evidence = JSON.stringify(evidence(row));
let state = stateFor();
let result = runGraph(play.nodes, row, state);
assert.equal(result.scored, true);
assert.equal(state.crm.properties.cargo_score, "100");
assert.equal(state.crm.properties.cargo_tier, "A");
assert.ok(state.local.fit_scored_at);
assert.equal(JSON.parse(state.local.fit_last_scored_result).score, 100);
assert.equal(state.agentCalls, 1);
assert.ok(!state.crm.properties.cargo_rationale.startsWith("[Out"));
// Extrapolation keeps the score; code, not the agent, flags it in the rationale.
const rangedF = structuredClone(liveF);
rangedF.features.find((x) => x.name === "employee_count").calibrated_range = {
  min: 10,
  max: 50,
};
state = stateFor({ features: rangedF });
result = runGraph(play.nodes, row, state);
assert.equal(result.scored, true);
assert.equal(state.crm.properties.cargo_score, "100");
assert.ok(
  state.crm.properties.cargo_rationale.startsWith(
    "[Out of calibrated range: employee_count] ",
  ),
);
assert.deepEqual(
  JSON.parse(state.local.fit_last_scored_result).out_of_calibrated_range,
  ["employee_count"],
);
for (const mode of [
  "emptyWrite",
  "failWrite",
  "malformed",
  "badReadback",
  "failStamp",
  "badStamp",
  "failFinalModel",
]) {
  state = stateFor({ [mode]: true });
  assert.throws(() => runGraph(play.nodes, row, state));
  assert.equal(state.local.fit_scored_at, undefined);
  assert.equal(state.local.fit_status, "error");
}
for (const mode of ["wrongTier", "wrongVersion"]) {
  state = stateFor({ [mode]: true });
  result = runGraph(play.nodes, row, state);
  assert.equal(result.status, "error");
  assert.equal(state.writes, 0);
}
state = stateFor({
  answer: { score: 1, tier: "C", rationale: "injected numeric authority" },
});
assert.throws(() => runGraph(play.nodes, row, state));
assert.equal(state.writes, 0);
state = stateFor({ draft: true });
result = runGraph(play.nodes, row, state);
assert.equal(result.status, "error");
assert.equal(state.writes, 0);
state = stateFor();
result = runGraph(play.nodes, fixtureRow(), state);
assert.equal(result.status, "insufficient_data");
assert.equal(state.writes, 0);
assert.equal(state.crm.properties.cargo_score, "55");

// Each late failure must preserve prior successful evidence and stop paid retries.
const retryConditions = play.filter.groups[0].conditions;
assert.ok(
  retryConditions.some(
    (c) =>
      c.columnSlug === "custom__fit_attempt_count" &&
      c.operator === "lowerThan" &&
      c.value === 3,
  ),
);
const rowWithState = (state) => ({
  ...row,
  ...Object.fromEntries(
    Object.entries(state.local).map(([k, v]) => [`custom__${k}`, v]),
  ),
});
for (const mode of ["failStamp", "badStamp", "failFinalModel"]) {
  const previous = {
    fit_last_scored_snapshot: '{"previous":"snapshot"}',
    fit_last_scored_result: '{"score":55,"tier":"B"}',
    fit_scored_at: "2020-01-01T00:00:00Z",
    fit_scoring_version: "previous",
  };
  state = stateFor({ [mode]: true, local: { ...previous } });
  for (let i = 1; i <= 3; i++) {
    assert.throws(() => runGraph(play.nodes, rowWithState(state), state));
    assert.equal(state.local.fit_attempt_count, i);
    for (const [k, v] of Object.entries(previous))
      assert.equal(state.local[k], v);
  }
  state[mode] = false;
  result = runGraph(play.nodes, rowWithState(state), state);
  assert.equal(result.status, "retry_exhausted");
  assert.equal(state.agentCalls, 3);
  // A reviewed version change creates a new allowance; success resets the count.
  state.local.fit_attempt_version = "previous";
  result = runGraph(play.nodes, rowWithState(state), state);
  assert.equal(result.scored, true);
  assert.equal(state.local.fit_attempt_count, 0);
}
state = stateFor();
result = runGraph(
  play.nodes,
  { ...row, id: undefined, hs_object_id: row.id },
  state,
);
assert.equal(result.scored, true);
state = stateFor();
assert.throws(
  () => runGraph(play.nodes, { ...row, hs_object_id: "conflict" }, state),
  /conflicting/,
);
assert.equal(state.agentCalls, 0);
state = stateFor();
const outdated = evidence(row);
outdated.feature_contract_version = "previous";
result = runGraph(
  play.nodes,
  { ...row, custom__fit_evidence: JSON.stringify(outdated) },
  state,
);
assert.equal(result.status, "insufficient_data");
assert.ok(
  JSON.parse(state.local.fit_result).data_quality_notes.some((n) =>
    n.includes("feature_contract_version"),
  ),
);
assert.equal(state.writes, 0);

// The packaged source runs under the backend's async-function wrapper locally.
// Native Python service execution itself remains a separately approved live test.
execFileSync(
  "python3",
  ["-m", "unittest", "discover", "-s", here, "-p", "test_*.py"],
  {
    env: {
      ...process.env,
      ACCOUNT_SCORING_INFRA: infra,
      PYTHONDONTWRITEBYTECODE: "1",
    },
    stdio: "pipe",
  },
);

// Exercise the real install planner; keep non-TS assets next to their resources.
if (!process.env.ACCOUNT_SCORING_INFRA) {
  const cdkEntry = require.resolve("@cargo-ai/cdk");
  const { planFiles } = await import(
    pathToFileURL(resolve(dirname(cdkEntry), "cli/commands/add.js"))
  );
  const planned = planFiles(resolve(here, ".."), "account-scoring");
  for (const suffix of [
    "runtime/scorer.py",
    "runtime/generated.ts",
    "runtime/requirements.txt",
    "context/account-fit-scoring.yaml",
  ]) {
    assert.ok(
      planned.some((p) => p.target === `infra/account-scoring/${suffix}`),
    );
  }
  assert.ok(
    planned.some((p) => p.target === "scripts/account-scoring/package.json"),
  );
  const tree = mkdtempSync(join(tmpdir(), "account-fit-install-"));
  try {
    cpSync(infra, join(tree, "infra/account-scoring"), {
      recursive: true,
      filter: (path) =>
        !path.includes(".cargo-ai") && !path.includes("__pycache__"),
    });
    cpSync(resolve(here, "../scripts"), join(tree, "scripts/account-scoring"), {
      recursive: true,
    });
    // An ESM project root, as in a scaffolded CDK project.
    writeFileSync(join(tree, "package.json"), '{"type":"module"}\n');
    execFileSync(
      process.execPath,
      [
        resolve(here, "../scripts/build.mjs"),
        "--infra",
        join(tree, "infra/account-scoring"),
        "--context",
        join(tree, "infra/account-scoring/context"),
        "--check",
      ],
      { stdio: "pipe" },
    );
    // Approved feature/outcome/score versions cannot be rewritten under one ID.
    const targetContext = join(tree, "infra/account-scoring/context");
    const featurePath = join(
      targetContext,
      "account-fit-feature-contract.yaml",
    );
    const scoringPath = join(targetContext, "account-fit-scoring.yaml");
    writeFileSync(featurePath, JSON.stringify(liveF));
    writeFileSync(scoringPath, JSON.stringify(liveC));
    const buildArgs = [
      resolve(here, "../scripts/build.mjs"),
      "--infra",
      join(tree, "infra/account-scoring"),
      "--context",
      targetContext,
    ];
    // A demo bundle keeps synthetic contracts and scores only listed fixtures.
    const demoF = structuredClone(liveF),
      demoC = structuredClone(liveC);
    demoF.synthetic = demoC.synthetic = true;
    demoF.version += "-demo";
    demoC.version += "-demo";
    demoC.feature_contract_version = demoF.version;
    demoC.demo_account_ids = ["fixture-id"];
    writeFileSync(featurePath, JSON.stringify(demoF));
    writeFileSync(scoringPath, JSON.stringify(demoC));
    assert.throws(
      () =>
        execFileSync(process.execPath, [...buildArgs, "--approved"], {
          stdio: "pipe",
        }),
      /non-synthetic/,
    );
    execFileSync(process.execPath, [...buildArgs, "--demo"], { stdio: "pipe" });
    const demoBundle = await import(
      pathToFileURL(join(tree, "infra/account-scoring/runtime/generated.ts"))
    );
    assert.deepEqual([...demoBundle.demoAccountIds], ["fixture-id"]);
    const demoScore = (id) => {
      const demoRow = fixtureRow({ id });
      demoRow.custom__fit_evidence = JSON.stringify({
        ...evidence(demoRow),
        feature_contract_version: demoF.version,
      });
      const snapshot = python(demoBundle.normalizeScript, {
        start: demoRow,
        script: { result: { now: new Date().toISOString() } },
      });
      return python(demoBundle.scoringScript, {
        start: { snapshot, contract_ref: demoC.version },
      });
    };
    assert.equal(demoScore("fixture-id").scoring_status, "scored");
    assert.equal(demoScore("real-account").scoring_status, "error");
    // Compile the demo play itself: filter, workflow branch and scorer agree.
    const modules = cdkEntry.slice(0, cdkEntry.lastIndexOf("/node_modules/") + 13);
    symlinkSync(modules, join(tree, "node_modules"), "dir");
    resetRegistry();
    await import(
      pathToFileURL(join(tree, "infra/account-scoring/plays/score-accounts.ts"))
    );
    const demoPlay = resources().find((r) => r.id === "play:score-accounts").spec;
    const demoTool = resources().find(
      (r) => r.id === "tool:compute-account-fit",
    ).spec;
    assert.ok(
      demoPlay.filter.groups.some((g) =>
        g.conditions.some(
          (x) =>
            x.columnSlug === "hs_object_id" &&
            x.operator === "is" &&
            JSON.stringify(x.values) === JSON.stringify(["fixture-id"]),
        ),
      ),
    );
    const demoRow = (id) => {
      const r = fixtureRow({ id });
      r.custom__fit_evidence = JSON.stringify({
        ...evidence(r),
        feature_contract_version: demoF.version,
      });
      return r;
    };
    state = stateFor();
    result = runGraph(demoPlay.nodes, demoRow("fixture-id"), state, demoTool.nodes);
    assert.equal(result.scored, true);
    assert.equal(state.writes, 2);
    state = stateFor({ crm: { id: "real-account", properties: {} } });
    result = runGraph(demoPlay.nodes, demoRow("real-account"), state, demoTool.nodes);
    assert.equal(result.status, "out_of_demo_scope");
    assert.deepEqual(state.local, {});
    assert.equal(state.writes + state.agentCalls, 0);
    const noIds = structuredClone(demoC);
    delete noIds.demo_account_ids;
    writeFileSync(scoringPath, JSON.stringify(noIds));
    assert.throws(
      () =>
        execFileSync(process.execPath, [...buildArgs, "--demo"], {
          stdio: "pipe",
        }),
      /demo_account_ids/,
    );
    // Approved numeric features must carry the range they were calibrated on,
    // including on a build that omits every flag.
    const unranged = structuredClone(liveF);
    delete unranged.features[0].calibrated_range;
    writeFileSync(featurePath, JSON.stringify(unranged));
    writeFileSync(scoringPath, JSON.stringify(liveC));
    for (const extra of [[], ["--approved"]])
      assert.throws(
        () =>
          execFileSync(process.execPath, [...buildArgs, ...extra], {
            stdio: "pipe",
          }),
        /calibrated_range/,
      );
    writeFileSync(featurePath, JSON.stringify(liveF));
    // Archive enforcement is automatic: omitting --approved cannot bypass it.
    execFileSync(process.execPath, buildArgs, { stdio: "pipe" });
    execFileSync(process.execPath, [...buildArgs, "--approved"], {
      stdio: "pipe",
    });
    execFileSync(process.execPath, [...buildArgs, "--check"], {
      stdio: "pipe",
    });
    // Archive writes are all-or-nothing. A forgotten scoring-version bump must
    // not claim the new feature version before the combined archive rejects it.
    const nextFeature = structuredClone(liveF);
    nextFeature.version += "-next";
    const reusedScoring = structuredClone(liveC);
    reusedScoring.feature_contract_version = nextFeature.version;
    writeFileSync(featurePath, JSON.stringify(nextFeature));
    writeFileSync(scoringPath, JSON.stringify(reusedScoring));
    assert.throws(
      () => execFileSync(process.execPath, buildArgs, { stdio: "pipe" }),
      /immutable/,
    );
    assert.equal(
      existsSync(
        join(
          targetContext,
          "account-fit-versions/features",
          `${nextFeature.version}.json`,
        ),
      ),
      false,
    );
    writeFileSync(featurePath, JSON.stringify(liveF));
    writeFileSync(scoringPath, JSON.stringify(liveC));
    const altered = structuredClone(liveC);
    altered.base_points = 1;
    writeFileSync(scoringPath, JSON.stringify(altered));
    assert.throws(
      () => execFileSync(process.execPath, buildArgs, { stdio: "pipe" }),
      /immutable/,
    );
    altered.version += "-new";
    writeFileSync(scoringPath, JSON.stringify(altered));
    const alteredFeature = structuredClone(liveF);
    alteredFeature.features[0].refresh_days = 30;
    writeFileSync(featurePath, JSON.stringify(alteredFeature));
    assert.throws(
      () => execFileSync(process.execPath, buildArgs, { stdio: "pipe" }),
      /immutable/,
    );
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
}
console.log(
  "ok: Python package, contract isolation, numeric authority, failure guards, CRM identity and disabled sweep",
);
