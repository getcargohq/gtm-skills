#!/usr/bin/env node
// Sync the fit model from the context into the resources.
//
// `context/icp/scoring.md` is the source: win-loss-review's scoring pass writes
// it, and people read it. Its fenced `json` block under `## Model` is the model.
// This script reads that block, checks it against the rules in
// `references/scoring-format.md`, and writes `infra/account-scoring/model.ts`,
// which the enrichment and the scoring import. Run it after every change to
// scoring.md, then `cargo-ai project plan` shows what the change does.
//
//   node scripts/account-scoring/sync-model.mjs
//   node scripts/account-scoring/sync-model.mjs --from <scoring.md> --to <model.ts>
//
// Why a generated file and not a read at run time: a script node computes the
// grade, and the model it computes with is bundled into the node at deploy, so
// every company in one deploy is scored by the same version. The contract
// re-parses scoring.md and fails when model.ts does not match it.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SLUG = /^[a-z][a-z0-9_]*$/;
const KINDS = ["firmographic", "provider", "research"];
const MODIFIER_LIMIT = 10;

/** The json block under `## Model`, parsed. Throws when there is none. */
export function extractModelBlock(markdown) {
  const heading = markdown.search(/^## Model\s*$/m);
  if (heading === -1) throw new Error("scoring.md has no `## Model` section");
  const fence = markdown.slice(heading).match(/```json\n([\s\S]*?)\n```/);
  if (!fence) throw new Error("the `## Model` section has no ```json block");
  return JSON.parse(fence[1]);
}

const isInt = (value) => Number.isInteger(value);

const pointsOf = (rule) =>
  rule.points !== undefined
    ? Object.values(rule.points)
    : (rule.ranges ?? []).map((range) => range.points);

/** Every way the model breaks the format's rules, as sentences. Empty means valid. */
export function validateModel(model) {
  const errors = [];
  const fail = (message) => errors.push(message);

  if (!isInt(model.model_version) || model.model_version < 1)
    fail("model_version must be a positive integer");

  const attributes = new Map();
  for (const attribute of model.attributes ?? []) {
    const where = `attribute ${attribute.slug}`;
    if (!SLUG.test(attribute.slug ?? ""))
      fail(`${where}: slug must be snake_case`);
    if (attributes.has(attribute.slug)) fail(`${where}: declared twice`);
    attributes.set(attribute.slug, attribute);
    if (!attribute.label) fail(`${where}: needs a label`);
    if (!attribute.definition) fail(`${where}: needs a definition`);
    if (!["number", "enum"].includes(attribute.type))
      fail(`${where}: type must be number or enum`);
    if (attribute.type === "enum") {
      const values = attribute.values ?? [];
      if (values.length < 2)
        fail(`${where}: an enum needs at least two values`);
      for (const value of values)
        if (!SLUG.test(value))
          fail(`${where}: value ${value} must be snake_case`);
      if (values.includes("unknown"))
        fail(`${where}: "unknown" is implicit, never a declared value`);
    }
    if (!KINDS.includes(attribute.get?.kind))
      fail(`${where}: get.kind must be one of ${KINDS.join(", ")}`);
    if (!attribute.get?.how)
      fail(`${where}: get.how must say where the value comes from`);
    if (attribute.get?.kind === "research" && attribute.type !== "enum")
      fail(
        `${where}: a research attribute must be an enum: a page gives a label, not a count`,
      );
  }
  if (attributes.size === 0) fail("the model declares no attribute");

  const checkValues = (where, attribute, rule) => {
    if (attribute.type === "enum") {
      if (rule.points === undefined || rule.ranges !== undefined)
        fail(`${where}: an enum attribute is scored with points, not ranges`);
      for (const key of Object.keys(rule.points ?? {}))
        if (!attribute.values.includes(key))
          fail(`${where}: ${key} is not a value of ${attribute.slug}`);
    } else {
      if (rule.ranges === undefined || rule.points !== undefined)
        fail(`${where}: a number attribute is scored with ranges, not points`);
      const mins = (rule.ranges ?? []).map((range) => range.min);
      if (mins.some((min, index) => index > 0 && min >= mins[index - 1]))
        fail(`${where}: ranges must go from the highest min to the lowest`);
    }
    if (!pointsOf(rule).every(isInt)) fail(`${where}: points must be integers`);
  };

  for (const filter of model.filters ?? []) {
    const where = `filter on ${filter.attribute}`;
    const attribute = attributes.get(filter.attribute);
    if (!attribute) {
      fail(`${where}: no such attribute`);
      continue;
    }
    const operators = ["below", "above", "in"].filter(
      (key) => filter[key] !== undefined,
    );
    if (operators.length !== 1)
      fail(`${where}: exactly one of below, above or in`);
    if (filter.in !== undefined) {
      if (attribute.type !== "enum") fail(`${where}: in applies to an enum`);
      for (const value of filter.in)
        if (!attribute.values.includes(value))
          fail(`${where}: ${value} is not a value of ${attribute.slug}`);
    } else if (attribute.type !== "number") {
      fail(`${where}: below and above apply to a number`);
    }
    if (!filter.why) fail(`${where}: needs a why`);
  }

  const weighted = new Set();
  let total = 0;
  for (const rule of model.weights ?? []) {
    const where = `weight on ${rule.attribute}`;
    const attribute = attributes.get(rule.attribute);
    if (!attribute) {
      fail(`${where}: no such attribute`);
      continue;
    }
    if (weighted.has(rule.attribute)) fail(`${where}: weighted twice`);
    weighted.add(rule.attribute);
    if (!isInt(rule.weight) || rule.weight <= 0)
      fail(`${where}: weight must be a positive integer`);
    total += rule.weight;
    checkValues(where, attribute, rule);
    const points = pointsOf(rule);
    if (Math.max(...points) !== rule.weight)
      fail(
        `${where}: its best value must score exactly its weight (${rule.weight})`,
      );
    if (Math.min(...points) < 0) fail(`${where}: points cannot be negative`);
    if (rule.unknown !== Math.floor(rule.weight / 2))
      fail(
        `${where}: unknown must be half the weight, rounded down (${Math.floor(rule.weight / 2)})`,
      );
  }
  if (total !== 100) fail(`weights must sum to 100 (they sum to ${total})`);

  for (const rule of model.modifiers ?? []) {
    const where = `modifier on ${rule.attribute}`;
    const attribute = attributes.get(rule.attribute);
    if (!attribute) {
      fail(`${where}: no such attribute`);
      continue;
    }
    if (weighted.has(rule.attribute))
      fail(`${where}: already weighted; an attribute is one or the other`);
    checkValues(where, attribute, rule);
    if (pointsOf(rule).some((points) => Math.abs(points) > MODIFIER_LIMIT))
      fail(
        `${where}: a modifier moves at most ${MODIFIER_LIMIT} points either way`,
      );
    if ((rule.unknown ?? 0) !== 0) fail(`${where}: a modifier's unknown is 0`);
  }

  const { strong, moderate } = model.bands ?? {};
  if (
    !isInt(strong) ||
    !isInt(moderate) ||
    !(strong > moderate && moderate > 0 && strong <= 100)
  )
    fail("bands need integers with 100 >= strong > moderate > 0");

  for (const attribute of attributes.values()) {
    const used =
      weighted.has(attribute.slug) ||
      (model.modifiers ?? []).some(
        (rule) => rule.attribute === attribute.slug,
      ) ||
      (model.filters ?? []).some((rule) => rule.attribute === attribute.slug);
    if (!used)
      fail(
        `attribute ${attribute.slug}: collected but never filtered, weighted or modified`,
      );
  }

  return errors;
}

/** The TypeScript module the resources import. */
export function renderModelModule(model, source) {
  return [
    `// Generated by scripts/account-scoring/sync-model.mjs from ${source}.`,
    "// Edit scoring.md and re-run the script; never edit this file by hand. The",
    "// contract fails when the two differ.",
    'import type { FitModel } from "./model-types";',
    "",
    `export const fitModel: FitModel = ${JSON.stringify(model, null, 2)};`,
    "",
  ].join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const index = args.indexOf(name);
    return index === -1 ? fallback : args[index + 1];
  };
  const from = option("--from", "context/icp/scoring.md");
  const to = option("--to", "infra/account-scoring/model.ts");
  const model = extractModelBlock(readFileSync(from, "utf8"));
  const errors = validateModel(model);
  if (errors.length > 0) {
    console.error(`${from} breaks the model format:\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }
  writeFileSync(to, renderModelModule(model, from));
  console.log(
    `wrote ${to}: model_version ${model.model_version}, ${model.attributes.length} attributes, ${model.weights.length} weights, ${(model.filters ?? []).length} filters`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
