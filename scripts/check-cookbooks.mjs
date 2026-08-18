#!/usr/bin/env node
// Validates the skill layer: one SKILL.md per outcome cookbook. Sibling of
// check-scaffold.mjs, which owns the `--from` dependency graph; this owns what
// is stacked on it. Dependency-free except `yaml`, because it must run on a
// bare clone with `npm ci --ignore-scripts` and no workspace.
//
// There used to be a second file, cookbook.json, carrying the contract as
// data. It was folded into SKILL.md on 2026-08-18: every reader of the
// contract is an agent, and agents read markdown, so the JSON was a second
// authored copy for a consumer that did not exist. What a gate genuinely
// needs to be structured (kind, state, approval) lives in frontmatter, which
// is YAML and therefore still checkable. `kind` lives in cargo.scaffold.json,
// beside `requires`, because both are facts about the folder.
//
// The rules, and why each exists:
//   - frontmatter parses as YAML: the installer skips a file that does not,
//     silently. tam-building shipped that way on day one ("cookie: Sales Nav"
//     read as a nested mapping) and was invisible to every agent.
//   - name == folder; description carries Triggers and Skip when: the
//     description is the only text an agent weighs before loading a skill,
//     and the negative case is what stops the wrong one loading.
//   - kind: foundation carries no SKILL.md (it defines no motion, and a skill
//     for it would compete for prompts it cannot serve); kind: outcome without
//     one is reported as still-to-convert, never failed, so the rollout stays
//     visible on every run.
//   - the four contract sections are present in every outcome skill: what
//     you will be asked, what you can change, what should not change, done
//     when. Prose cannot be gated for field completeness; presence is what
//     stops a cookbook shipping with the adaptation model half written.
//   - approved needs its evidence: a fresh-workspace date AND two
//     implementations. The approval rule is the one thing standing between a
//     launch post and a claim nobody tested.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const toConvert = [];

const scaffold = JSON.parse(
  readFileSync(join(root, "cargo.scaffold.json"), "utf8"),
);
const folders = scaffold.folders ?? {};

const REQUIRED_SECTIONS = [
  "## What you will be asked",
  "## What you can change",
  "## What should not change",
  "## Done when",
];

const frontmatter = (text) => {
  if (!text.startsWith("---\n")) return { error: "has no YAML frontmatter" };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { error: "has frontmatter that is never closed" };
  try {
    const parsed = parseYaml(text.slice(4, end));
    if (!parsed || typeof parsed !== "object") {
      return { error: "has frontmatter that did not parse to a mapping" };
    }
    return { data: parsed, body: text.slice(end + 4) };
  } catch (e) {
    return {
      error: `has a YAML parse error, so the installer will silently skip it: ${e.message.split("\n")[0]}`,
    };
  }
};

for (const [name, entry] of Object.entries(folders)) {
  const kind = entry.kind;
  if (!["outcome", "foundation"].includes(kind)) {
    errors.push(
      `cargo.scaffold.json folder "${name}" has kind "${kind}", expected outcome or foundation`,
    );
    continue;
  }
  const skillPath = join(root, name, "SKILL.md");
  const hasSkill = existsSync(skillPath);

  if (kind === "foundation") {
    if (hasSkill) {
      errors.push(
        `${name} is a foundation and must not carry a SKILL.md: it would compete for prompts it cannot serve`,
      );
    }
    continue;
  }

  if (!hasSkill) {
    toConvert.push(name);
    continue;
  }

  const {
    data: fm,
    body,
    error,
  } = frontmatter(readFileSync(skillPath, "utf8"));
  if (error) {
    errors.push(`${name}/SKILL.md ${error}`);
    continue;
  }
  if (fm.name !== name) {
    errors.push(
      `${name}/SKILL.md frontmatter name is "${fm.name}", expected "${name}"`,
    );
  }
  const d = fm.description ?? "";
  if (!d)
    errors.push(
      `${name}/SKILL.md has no description: it is the only text an agent sees before loading`,
    );
  if (d && !/Triggers:/.test(d))
    errors.push(`${name}/SKILL.md description carries no "Triggers:" clause`);
  if (d && !/Skip when:/.test(d))
    errors.push(`${name}/SKILL.md description carries no "Skip when:" clause`);
  if (!fm.outcome || String(fm.outcome).length < 20) {
    errors.push(
      `${name}/SKILL.md frontmatter needs an "outcome" line a user would recognise: it is what the menu renders`,
    );
  }
  if (!["to-be-approved", "approved"].includes(fm.state)) {
    errors.push(
      `${name}/SKILL.md frontmatter state must be "to-be-approved" or "approved"`,
    );
  }
  if (fm.state === "approved") {
    const a = fm.approval ?? {};
    if (!a.demoWorkspace)
      errors.push(
        `${name} is marked approved but has no approval.demoWorkspace date`,
      );
    if (!Array.isArray(a.implementations) || a.implementations.length < 2) {
      errors.push(
        `${name} is marked approved but lists ${a.implementations?.length ?? 0} implementations: the rule is two`,
      );
    }
  }
  for (const section of REQUIRED_SECTIONS) {
    if (!body.includes(`\n${section}`)) {
      errors.push(`${name}/SKILL.md is missing the "${section}" section`);
    }
  }
  if (/cookbook\.json/.test(body)) {
    errors.push(
      `${name}/SKILL.md refers to cookbook.json, which no longer exists`,
    );
  }
}

// A SKILL.md in a folder the scaffold does not declare is a skill nobody can install.
for (const entry of readdirSync(root)) {
  if (
    entry.startsWith(".") ||
    entry === "deploy-cookbook" ||
    entry === "node_modules"
  )
    continue;
  const dir = join(root, entry);
  if (!statSync(dir).isDirectory()) continue;
  if (existsSync(join(dir, "SKILL.md")) && !(entry in folders)) {
    errors.push(
      `${entry}/SKILL.md exists but "${entry}" is not declared in cargo.scaffold.json`,
    );
  }
}

const procedure = join(root, "deploy-cookbook", "SKILL.md");
if (!existsSync(procedure)) {
  errors.push(
    "deploy-cookbook/SKILL.md is missing: it is the procedure every cookbook skill defers to",
  );
} else if (/cookbook\.json/.test(readFileSync(procedure, "utf8"))) {
  errors.push(
    "deploy-cookbook/SKILL.md refers to cookbook.json, which no longer exists",
  );
}

if (errors.length) {
  console.error("cookbook skill layer is out of sync:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const outcomes = Object.values(folders).filter(
  (f) => f.kind === "outcome",
).length;
console.log(
  `ok: ${outcomes - toConvert.length}/${outcomes} outcome cookbooks carry a SKILL.md`,
);
if (toConvert.length)
  console.log(`   still to convert: ${toConvert.join(", ")}`);
