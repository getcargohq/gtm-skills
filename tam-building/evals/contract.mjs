// The boundaries CDK schema validation cannot express, checked against the
// compiled registry. `cargo-cdk check` proves the resources are well formed;
// this proves they are still the pipeline this skill describes after an agent
// has adapted them.
//
// Run it from the skill folder after every adaptation:
//   node --import tsx evals/contract.mjs
import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
const stamp = Date.now();
await import(`../infra/models/tam-companies.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

const get = (id) => {
  const resource = byId.get(id);
  assert.ok(resource, `${id} must exist`);
  return resource;
};

// ---------------------------------------------------------------------------
// The source is the model, and its filter is the TAM.
// ---------------------------------------------------------------------------
const sourceSpec = get("model:tam_companies").spec;

assert.equal(
  sourceSpec.extractorSlug,
  "fetchCompanies",
  "the company universe must be the fetchCompanies extractor on the model",
);

const filterGroups = Object.entries(sourceSpec.config ?? {}).filter(
  ([key]) => key !== "limit",
);
assert.ok(
  filterGroups.length > 0,
  "the model config must carry at least one ICP filter group: an unfiltered search sources the whole database up to limit",
);
for (const [key, value] of filterGroups) {
  assert.equal(
    typeof value === "object" && value !== null && !Array.isArray(value),
    true,
    `config.${key} must be a nested filter group, not a flat value: a flat map is ignored silently and you pay for the whole database`,
  );
}

for (const group of ["industry", "employeeSize", "companyLocation"]) {
  assert.ok(
    filterGroups.some(([key]) => key === group),
    `the model config must carry the ${group} group: industries, company size and countries are the minimum of every TAM, and without one the search bills for the whole dimension`,
  );
}

assert.equal(
  typeof sourceSpec.config?.limit,
  "number",
  "the model config must set an explicit limit: the search bills per returned record and this is the only cap",
);

assert.equal(
  sourceSpec.schedule ?? null,
  null,
  "the sourced model must not carry a schedule: a cron re-runs the search and re-bills every returned record, including the rows already sourced",
);

// ---------------------------------------------------------------------------
// Atomic: one connector, one model, one folder. Nothing judges, nothing writes.
// ---------------------------------------------------------------------------
for (const id of byId.keys()) {
  const kind = id.split(":")[0];
  assert.ok(
    ["model", "connector", "folder"].includes(kind),
    `${id} is a ${kind}: this skill sources a TAM and deploys no play, agent, tool or segment`,
  );
}
const connectors = [...byId.values()].filter(
  (resource) => resource.id.startsWith("connector:"),
);
assert.deepEqual(
  connectors.map((resource) => resource.spec.integrationSlug),
  ["aiArk"],
  "the only connector is AI Ark: a CRM or an LLM is a dependency of a next step, not of building the TAM",
);
const models = [...byId.keys()].filter((id) => id.startsWith("model:"));
assert.deepEqual(
  models,
  ["model:tam_companies"],
  "the only model is the sourced universe: CRM extracts and the unified accounts model belong to the next steps that need them",
);

console.log(
  "ok: one connector, one model, and the ICP filter carries industries, company size and countries",
);
