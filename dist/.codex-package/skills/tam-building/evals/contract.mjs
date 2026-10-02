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
await import(`../infra/plays/tier-companies.ts?contract=${stamp}`);
await import(`../infra/segments/tiers.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

const get = (id) => {
  const resource = byId.get(id);
  assert.ok(resource, `${id} must exist`);
  return resource;
};

const findOne = (nodes, predicate, message) => {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, message);
  return matches[0];
};

const child = (nodes, node) =>
  nodes.find((candidate) => candidate.uuid === node.childrenUuids[0]);

// ---------------------------------------------------------------------------
// The source is the model, and its filter is the TAM.
// ---------------------------------------------------------------------------
const modelSpec = get("model:tam_companies").spec;

assert.equal(
  modelSpec.extractorSlug,
  "fetchCompanies",
  "the company universe must be an extractor on the model, not a connector action inside the play",
);

const filterGroups = Object.entries(modelSpec.config ?? {}).filter(
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

assert.equal(
  typeof modelSpec.config?.limit,
  "number",
  "the model config must set an explicit limit: the search bills per returned record and this is the only cap",
);

assert.equal(
  modelSpec.schedule ?? null,
  null,
  "the model must not carry a schedule: a cron re-runs the search and re-bills every returned record, including the rows already sourced",
);

const declaredColumns = new Set(
  (modelSpec.additionalColumns ?? []).map((column) => column.slug),
);
for (const slug of ["tier", "tier_rationale", "tier_evidence_url", "tiered_at"]) {
  assert.equal(
    declaredColumns.has(slug),
    true,
    `the model must declare the custom column "${slug}" that the play writes`,
  );
}

// ---------------------------------------------------------------------------
// The agent judges. It cannot write, and it cannot read a rubric it was not given.
// ---------------------------------------------------------------------------
const agentSpec = get("agent:tam-tier-analyst").spec;

const capabilitySlugs = new Set(
  (agentSpec.capabilities ?? []).map((capability) => capability.slug),
);
assert.equal(
  capabilitySlugs.has("context"),
  true,
  "the tiering agent must carry the context capability: without it the rubric reference in its prompt reads nothing and it invents a rubric",
);
const contextCapability = (agentSpec.capabilities ?? []).find(
  (capability) => capability.slug === "context",
);
assert.equal(
  contextCapability.config?.isReadOnly,
  true,
  "the context capability must be read-only: the agent reads the rubric, it does not edit it",
);
assert.equal(
  capabilitySlugs.has("webSearch"),
  true,
  "the tiering agent must carry webSearch: the evidence that separates tier A from tier C is not in the sourced row",
);
assert.equal(
  capabilitySlugs.has("memory"),
  false,
  "the tiering agent must not carry memory: each company is an independent judgment, and a prior rationale leaking into the next row is how a book fills with copied reasons",
);

assert.deepEqual(
  agentSpec.models ?? [],
  [],
  "the tiering agent must have no model in uses: an agent that can write decides its own routing, and a null tier stops being distinguishable from a bad judgment",
);

assert.equal(
  agentSpec.output?.type,
  "jsonSchema",
  "the tiering agent must declare a jsonSchema output so the play's write mappings cannot drift from the judgment shape",
);
const judgmentProperties = agentSpec.output.jsonSchema.properties ?? {};
assert.ok(
  Array.isArray(judgmentProperties.tier?.enum) &&
    judgmentProperties.tier.enum.length > 1,
  "the tier property must be an enum: a free-string tier lands values no segment matches",
);
assert.ok(
  agentSpec.evaluator?.rubric,
  "the tiering agent must carry an evaluator rubric: it is what fails a tier with no grounded rationale",
);

// ---------------------------------------------------------------------------
// The play orchestrates and owns the only write.
// ---------------------------------------------------------------------------
const playResource = get("play:tier-companies");
const playNodes = playResource.spec.nodes;
assert.ok(Array.isArray(playNodes), "the play must have workflow nodes");

const start = findOne(
  playNodes,
  (node) => node.kind === "native" && node.actionSlug === "start",
  "the play must have one start node",
);
const agentCall = findOne(
  playNodes,
  (node) =>
    node.kind === "agent" &&
    node.agentUuid?.resourceId === "agent:tam-tier-analyst",
  "the play must contain exactly one tiering agent node: one judgment per company",
);
assert.equal(
  child(playNodes, start)?.uuid,
  agentCall.uuid,
  "the agent must be the play's first workflow node",
);

assert.equal(
  playNodes.some((node) => node.kind === "connector"),
  false,
  "the play must contain no connector node: sourcing is the model's extractor, and a search inside the play bills per row a second time",
);

const write = findOne(
  playNodes,
  (node) => node.kind === "native" && node.actionSlug === "modelCustomColumn",
  "the play must contain exactly one write, and it must write custom columns on the triggering row",
);
assert.equal(
  child(playNodes, agentCall)?.uuid,
  write.uuid,
  "the write must immediately consume the agent's judgment",
);
assert.equal(
  write.config.modelUuid?.resourceId,
  "model:tam_companies",
  "the play must write back to the model it runs on",
);

const written = new Map(
  write.config.mappings.map((mapping) => [mapping.columnSlug, mapping.value]),
);
for (const slug of ["tier", "tier_rationale", "tier_evidence_url", "tiered_at"]) {
  assert.equal(
    written.has(slug),
    true,
    `the write must set "${slug}": a tier with no rationale is a number a rep will not trust, and a tier with no stamp is re-judged forever`,
  );
}
for (const slug of written.keys()) {
  assert.equal(
    slug.startsWith("custom__"),
    false,
    `the write mapping "${slug}" carries the custom__ read-side alias: the write path nests the declared slug under custom itself, so the node reports success and the value is silently dropped`,
  );
  assert.equal(
    declaredColumns.has(slug),
    true,
    `the write mapping "${slug}" is not a column the model declares`,
  );
}

// ---------------------------------------------------------------------------
// Eligibility is the stamp, and it lives in the play trigger.
// ---------------------------------------------------------------------------
const conditions = playResource.spec.filter.groups.flatMap(
  (group) => group.conditions,
);
const stampConditions = conditions.filter(
  (condition) => condition.columnSlug === "custom__tiered_at",
);
assert.deepEqual(
  new Set(stampConditions.map((condition) => condition.operator)),
  new Set(["isNull", "lowerThan"]),
  "the play trigger must enrol never-tiered rows and rows whose stamp has gone stale",
);
assert.equal(
  conditions.some((condition) => condition.columnSlug === "custom__tier"),
  false,
  "the play trigger must not filter on the tier itself: a failed run leaves a null stamp and must be retried, while a legitimate disqualified verdict must be left alone",
);
assert.deepEqual(
  playResource.spec.changeKinds,
  ["added"],
  "the play must create runs only for rows entering the segment: without it the LLM bill scales with how often the cron fires",
);
assert.equal(
  playResource.spec.isEnabled,
  false,
  "the first plan must ship the play disabled",
);
assert.equal(
  playResource.spec.runCreationRule,
  "noConcurrency",
  "the play must be noConcurrency while it is a pilot",
);
assert.equal(
  playResource.spec.schedule?.type,
  "cron",
  "fetchCompanies is a plain fetch-mode extractor, so the play takes a cron: watch needs isWatchable and realtime needs an ingest-mode extractor",
);

// ---------------------------------------------------------------------------
// Segments view the output, they do not restate the trigger.
// ---------------------------------------------------------------------------
const segments = [...byId.values()].filter((resource) =>
  resource.id.startsWith("segment:"),
);
assert.ok(segments.length > 0, "the skill must expose the tiers as segments");
const segmentTiers = new Set();
for (const segment of segments) {
  const conditions = segment.spec.filter.groups.flatMap(
    (group) => group.conditions,
  );
  assert.equal(
    conditions.every((condition) => condition.columnSlug === "custom__tier"),
    true,
    `${segment.id} filters on something other than the tier: a segment that restates the play's own trigger is dead weight and a drift trap`,
  );
  for (const condition of conditions) {
    for (const value of condition.values ?? []) segmentTiers.add(value);
  }
}
const agentTiers = new Set(judgmentProperties.tier.enum);
assert.deepEqual(
  [...segmentTiers].sort(),
  [...agentTiers].sort(),
  "every value in the agent's tier enum must have a segment, and every segment value must be in that enum: a missing slice is a row that Done when claims to reconcile and cannot",
);

assert.equal(
  [...byId.keys()].some((id) => id.startsWith("context:")),
  false,
  "this skill must not declare defineContext: that singleton belongs to the project, and a nested copy syncs markdown nobody curates",
);

console.log(
  "ok: the ICP filter is the model, the agent judges without writing, and the play owns the only write back onto the sourced row",
);
