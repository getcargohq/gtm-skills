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
await import(`../infra/models/crm-accounts.ts?contract=${stamp}`);
await import(`../infra/models/accounts.ts?contract=${stamp}`);

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

assert.deepEqual(
  sourceSpec.unification,
  { source: "integration" },
  "the sourced model must unify on AI Ark's own domain and LinkedIn mapping: a model that stops unifying lands its rows nowhere the report reads",
);

// ---------------------------------------------------------------------------
// The CRM is read, never written, and unifies into the same accounts.
// ---------------------------------------------------------------------------
const crmSpec = get("model:crm_accounts").spec;

assert.equal(
  crmSpec.config?.objectType,
  "companies",
  "the CRM model must extract companies: the report compares accounts, not contacts",
);
assert.deepEqual(
  crmSpec.unification,
  { source: "integration" },
  "the CRM model must unify as an account: without it no sourced company can ever read as already in the CRM",
);

// ---------------------------------------------------------------------------
// The unified accounts model is adopted, and its merge rules are left alone.
// ---------------------------------------------------------------------------
const accountsSpec = get("model:accounts").spec;

assert.equal(
  accountsSpec.extractorSlug,
  "unifyAccounts",
  "the accounts model must be the workspace's unified accounts, adopted through unifyAccounts",
);
assert.equal(
  accountsSpec.config ?? null,
  null,
  "the unified accounts model must declare no config: its reference strengths decide merges for the CRM and every other source, and a sourcing skill must not change them for everyone",
);

// ---------------------------------------------------------------------------
// Models only. Nothing judges, nothing writes.
// ---------------------------------------------------------------------------
for (const id of byId.keys()) {
  const kind = id.split(":")[0];
  assert.ok(
    ["model", "connector", "folder"].includes(kind),
    `${id} is a ${kind}: this skill sources and unifies, and deploys no play, agent, tool or segment`,
  );
}

console.log(
  "ok: the ICP filter is the model, sourced and CRM companies unify into the adopted accounts, and nothing writes",
);
