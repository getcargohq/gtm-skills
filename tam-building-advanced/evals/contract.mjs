// The boundaries schema validation cannot express, checked against the
// compiled registry. `cargo-ai project check` proves the resources are well
// formed; this proves they are still the pipeline this skill describes after
// an agent has adapted them.
//
// Run it from the skill folder after every adaptation:
//   node --import tsx evals/contract.mjs
import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
const stamp = Date.now();
for (const file of [
  "plays/unify-sales-navigator.ts",
  "plays/unify-ai-ark.ts",
  "plays/unify-apollo.ts",
  "plays/unify-exa.ts",
]) {
  await import(`../infra/${file}?contract=${stamp}`);
}

const byId = new Map(resources().map((resource) => [resource.id, resource]));

const get = (id) => {
  const resource = byId.get(id);
  assert.ok(resource, `${id} must exist`);
  return resource;
};

const integrationOf = (modelSpec) =>
  get(modelSpec.datasetUuid.resourceId).spec.integrationSlug;

const valueAt = (config, path) =>
  path.reduce(
    (node, key) => (node === undefined || node === null ? node : node[key]),
    config,
  );

// ---------------------------------------------------------------------------
// The paid sources. Each one names its extractor and where industries, company
// size and countries live in its config: the three criteria every source
// carries, because a source without one bills for the whole dimension.
// ---------------------------------------------------------------------------
const PAID_SOURCES = {
  "model:tam_source_sales_navigator": {
    integration: "salesNavigator",
    extractor: "fetchAccountSearch",
  },
  "model:tam_source_ai_ark": {
    integration: "aiArk",
    extractor: "fetchCompanies",
    minimum: {
      industries: ["industry"],
      size: ["employeeSize"],
      countries: ["companyLocation"],
    },
  },
  "model:tam_source_apollo": {
    integration: "apolloio",
    extractor: "fetchOrganizations",
    minimum: {
      industries: ["filters", "q_organization_keyword_tags"],
      size: ["filters", "organization_num_employees_ranges"],
      countries: ["filters", "organization_locations"],
    },
  },
};

for (const [id, source] of Object.entries(PAID_SOURCES)) {
  const spec = get(id).spec;
  const config = spec.config ?? {};
  assert.equal(
    integrationOf(spec),
    source.integration,
    `${id} must source from ${source.integration}`,
  );
  assert.equal(
    spec.extractorSlug,
    source.extractor,
    `${id} must use ${source.integration}.${source.extractor}`,
  );
  assert.equal(
    typeof config.limit,
    "number",
    `${id} must set an explicit limit: it bills per returned record and this is the only cap`,
  );
  assert.equal(
    spec.schedule ?? null,
    null,
    `${id} must not carry a schedule: a cron re-runs the search and re-bills every returned record, including the companies already in the TAM`,
  );
  for (const [criterion, path] of Object.entries(source.minimum ?? {})) {
    const value = valueAt(config, path);
    assert.ok(
      value !== undefined && value !== null,
      `${id} must set ${criterion} (config.${path.join(".")}): without it the search has no edge in that dimension`,
    );
  }
}

// AI Ark filters are nested groups. A flat key is ignored silently and the
// sync sources the whole database up to limit.
const aiArkConfig = get("model:tam_source_ai_ark").spec.config;
for (const [key, value] of Object.entries(aiArkConfig)) {
  if (key === "limit" || key === "lookalikeDomains") continue;
  assert.ok(
    typeof value === "object" && value !== null && !Array.isArray(value),
    `tam_source_ai_ark config.${key} must be a nested filter group, not a flat value`,
  );
}

// Sales Navigator: every search carries the three criteria inside its URL, and
// no LinkedIn seat is attached.
const salesNavigatorConfig = get("model:tam_source_sales_navigator").spec
  .config;
assert.ok(
  Array.isArray(salesNavigatorConfig.urls) &&
    salesNavigatorConfig.urls.length > 0,
  "tam_source_sales_navigator must list at least one search URL",
);
for (const url of salesNavigatorConfig.urls) {
  for (const filterType of ["INDUSTRY", "COMPANY_HEADCOUNT", "REGION"]) {
    assert.ok(
      url.includes(`type:${filterType}`),
      `every Sales Navigator search must filter on ${filterType}: ${url.slice(0, 120)}…`,
    );
  }
}
assert.equal(
  salesNavigatorConfig.identityIds,
  undefined,
  "tam_source_sales_navigator must not attach identityIds: the search runs without a LinkedIn seat, and a seat puts that account at risk",
);

// Exa has no extractor: its source is the written queries.
const exaQueries = get("model:tam_exa_queries").spec;
assert.equal(exaQueries.datasetUuid, "native");
assert.ok(
  exaQueries.config.columns.some((column) => column.slug === "query"),
  "tam_exa_queries must hold one query per row",
);

// ---------------------------------------------------------------------------
// One TAM, keyed on the LinkedIn company id, with provenance and the CRM side.
// ---------------------------------------------------------------------------
const universe = get("model:tam_universe").spec;
assert.equal(universe.datasetUuid, "native");
assert.equal(universe.extractorSlug, "defineCustom");
const universeColumns = new Set(
  universe.config.columns.map((column) => column.slug),
);
for (const column of [
  "linkedin_company_id",
  "domain",
  "category",
  "status",
  "exclusion_reason",
  "in_crm",
  "found_by_sales_navigator",
  "found_by_ai_ark",
  "found_by_apollo",
  "found_by_exa",
  "first_source",
]) {
  assert.ok(
    universeColumns.has(column),
    `tam_universe must keep ${column}: the report reads coverage, overlap and net new from it`,
  );
}

// ---------------------------------------------------------------------------
// Every source reaches the TAM through the same door, one play per source,
// disabled until the first sync, and enrolling only rows that arrive.
// ---------------------------------------------------------------------------
const PLAYS = {
  "play:tam_unify_sales_navigator": "model:tam_source_sales_navigator",
  "play:tam_unify_ai_ark": "model:tam_source_ai_ark",
  "play:tam_unify_apollo": "model:tam_source_apollo",
  "play:tam_search_exa": "model:tam_exa_queries",
};
for (const [id, modelId] of Object.entries(PLAYS)) {
  const spec = get(id).spec;
  assert.equal(
    spec.modelUuid.resourceId,
    modelId,
    `${id} must run on ${modelId}`,
  );
  assert.deepEqual(
    spec.changeKinds,
    ["added"],
    `${id} must enrol only rows that arrive: anything else re-runs the enrichment over rows already in the TAM`,
  );
  assert.equal(
    spec.isEnabled,
    false,
    `${id} must ship disabled: it is enabled after the first sync, one source at a time`,
  );
}
get("tool:tam_unify_company");
get("tool:tam_write_company");

// ---------------------------------------------------------------------------
// Read only outside Cargo. The connectors are the four sources and LinkedIn;
// a CRM connector exists only under the crm-backed variation, and only to
// read its companies.
// ---------------------------------------------------------------------------
const connectors = [...byId.values()]
  .filter((resource) => resource.id.startsWith("connector:"))
  .map((resource) => resource.spec.integrationSlug)
  .sort();
const CRM_INTEGRATIONS = ["hubspot", "salesforce", "attio"];
const expected = ["aiArk", "apolloio", "exa", "linkedin", "salesNavigator"];
assert.deepEqual(
  connectors.filter((slug) => !CRM_INTEGRATIONS.includes(slug)),
  expected,
  "the connectors are the four sources and LinkedIn: a fifth source is a recorded decision, edit this check in the same change",
);
for (const resource of byId.values()) {
  if (!resource.id.startsWith("model:")) continue;
  const spec = resource.spec;
  if (spec.datasetUuid === "native") continue;
  if (!CRM_INTEGRATIONS.includes(integrationOf(spec))) continue;
  assert.equal(
    spec.extractorSlug,
    "fetchRecords",
    `${resource.id}: a CRM is only read here, with fetchRecords and no filter`,
  );
}

console.log(
  "ok: four sources with their criteria and budgets, one TAM keyed on the LinkedIn company id, one play per source, nothing written outside Cargo",
);
