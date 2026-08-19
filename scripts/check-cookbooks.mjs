#!/usr/bin/env node
// Validates the cookbooks: the skills that carry a worked cookbook: the folders with models/,
// plays/, agents/ and so on beside their SKILL.md.
// The one-off skills are validated by validate.ts (slugs, prices, playbooks);
// this owns everything a cookbook adds on top. Both run under `npm run validate`.
//
// Mechanically: a root folder that carries resource code (models/, plays/,
// agents/, ...). It becomes a skill when it carries a SKILL.md whose
// frontmatter says `metadata.source: cookbook`; until then it is reported
// as still-to-convert, never failed, so the rollout stays visible on every run.
//
// Every such folder is ISOLATED: it carries every model, connector and folder
// it imports, and no relative import may escape it. There is no shared
// foundation and no requires graph; the agent placing the example reconciles
// it with whatever the target project already declares.
//
// SKILL.md is customer-facing: `skills add` installs it and an agent loads it.
// So it carries the standard skill frontmatter and the contract, and nothing
// else. Cargo's own bookkeeping (state, approval evidence, chain position)
// lives in .github/data/approvals.json, which no customer sees. The one thing
// a customer should see is the honest banner at the top of the body,
// "State: to-be-approved.", and it must follow the bookkeeping exactly.
//
// The rules, and why each exists:
//   - frontmatter parses as YAML: the installer skips a file that does not,
//     silently. tam-building shipped that way once ("cookie: Sales Nav" read
//     as a nested mapping) and was invisible to every agent.
//   - name == folder; description carries Triggers and Skip when: the
//     description is the only text an agent weighs before loading a skill.
//   - the four contract sections are present: what you will be asked, what you
//     can change, what should not change, done when. Prose cannot be gated for
//     field completeness; presence is what stops an engine shipping with the
//     adaptation model half written.
//   - no relative import escapes the folder: isolation is the contract, and a
//     stray `../../other/...` is the one way to break it silently.
//   - the inline procedure section is present: each skill carries its own
//     "Put it in your project", the way every one-off skill here carries its
//     own Setup. There is no shared procedure skill to depend on.
//   - approved needs its evidence: a fresh-workspace date AND two
//     implementations. The banner must be present exactly while the state is
//     to-be-approved, and absent once approved, so approving in the data file
//     and forgetting the customer file is a red build.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const RESOURCE_DIRS = new Set([
  "models",
  "plays",
  "agents",
  "segments",
  "connectors",
  "tools",
  "apps",
  "mcp",
  "context",
  "files",
  "territories",
  "capacities",
  "folders",
  "workers",
]);
const REQUIRED_SECTIONS = [
  "## Put it in your project",
  "## What you will be asked",
  "## What you can change",
  "## What should not change",
  "## Done when",
];

const approvals = JSON.parse(
  readFileSync(join(root, ".github/data/approvals.json"), "utf8"),
);

const frontmatter = (text) => {
  if (!text.startsWith("---\n")) return { error: "has no YAML frontmatter" };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { error: "has frontmatter that is never closed" };
  try {
    const parsed = parseYaml(text.slice(4, end));
    if (!parsed || typeof parsed !== "object")
      return { error: "has frontmatter that did not parse to a mapping" };
    return { data: parsed, body: text.slice(end + 4) };
  } catch (e) {
    return {
      error: `has a YAML parse error, so the installer will silently skip it: ${e.message.split("\n")[0]}`,
    };
  }
};

const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === "node_modules") continue;
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") && !p.endsWith(".d.ts")) out.push(p);
  }
  return out;
};

const isExampleFolder = (name) => {
  const dir = join(root, name);
  if (
    !statSync(dir).isDirectory() ||
    name.startsWith(".") ||
    name === "node_modules"
  )
    return false;
  return readdirSync(dir).some(
    (f) => RESOURCE_DIRS.has(f) && statSync(join(dir, f)).isDirectory(),
  );
};

const exampleFolders = readdirSync(root).filter(isExampleFolder).sort();
const allSkillFolders = readdirSync(root).filter(
  (d) =>
    !d.startsWith(".") &&
    statSync(join(root, d)).isDirectory() &&
    existsSync(join(root, d, "SKILL.md")),
);

for (const name of exampleFolders) {
  const skillPath = join(root, name, "SKILL.md");
  if (!existsSync(skillPath)) {
    // A folder without a skill is not a skill and does not belong at the root:
    // everything here installs with `skills add`. Worked examples written
    // before their skill live in history (see CONTRIBUTING.md), not in the tree.
    errors.push(
      `${name}/ carries resource code but no SKILL.md: restore it with its skill, or not at all`,
    );
    continue;
  }
  if (!(name in approvals)) {
    errors.push(
      `${name} carries resource code but has no entry in .github/data/approvals.json`,
    );
    continue;
  }
  const record = approvals[name];
  const {
    data: fm,
    body,
    error,
  } = frontmatter(readFileSync(skillPath, "utf8"));
  if (error) {
    errors.push(`${name}/SKILL.md ${error}`);
    continue;
  }

  if (fm.name !== name)
    errors.push(
      `${name}/SKILL.md frontmatter name is "${fm.name}", expected "${name}"`,
    );
  if (fm.metadata?.source !== "cookbook") {
    errors.push(
      `${name}/SKILL.md carries resource code, so its frontmatter needs metadata.source: cookbook (validate.ts skips it and this script owns it)`,
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
  for (const key of ["outcome", "chain", "state", "approval"]) {
    if (key in fm)
      errors.push(
        `${name}/SKILL.md frontmatter carries "${key}": Cargo bookkeeping lives in .github/data/approvals.json, not in the customer-facing skill`,
      );
  }
  for (const section of REQUIRED_SECTIONS) {
    if (!body.includes(`\n${section}`))
      errors.push(`${name}/SKILL.md is missing the "${section}" section`);
  }
  if (
    /cookbook\.json|cargo\.scaffold\.json|manifest add|cdk init --from|base-gtm|crm-sync|deploy-cookbook/.test(
      body,
    )
  ) {
    errors.push(
      `${name}/SKILL.md refers to scaffold machinery (cookbook.json, cargo.scaffold.json, manifest add, cdk init --from, base-gtm, crm-sync, deploy-cookbook) that no longer exists`,
    );
  }

  // A `## Requires` section contradicts isolation: a cookbook carries what it
  // needs, and the agent reconciles duplicates against the project. Refuse it.
  if (/\n## Requires\n/.test(body)) {
    errors.push(
      `${name}/SKILL.md carries a "## Requires" section: cookbooks are self-contained, and what the project already has is reconciled by the agent, not declared here`,
    );
  }

  // Isolation: no relative import may leave the folder.
  for (const dp of walk(join(root, name))) {
    const code = readFileSync(dp, "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    for (const m of code.matchAll(
      /^\s*import\s[^;]*?from\s+"(\.\.?\/[^"]+)"/gm,
    )) {
      const tgt = resolve(dirname(dp), m[1]);
      if (!tgt.startsWith(join(root, name) + "/")) {
        errors.push(
          `${name}/${dp.slice(root.length + name.length + 2)} imports ${m[1]}, which escapes the folder: every skill is self-contained`,
        );
      }
    }
  }

  // The banner follows the bookkeeping.
  const state = record.state;
  if (!["to-be-approved", "approved"].includes(state))
    errors.push(`approvals.json: ${name} has state "${state}"`);
  if (state === "approved") {
    if (!record.demoWorkspace)
      errors.push(
        `${name} is marked approved but has no demoWorkspace date in approvals.json`,
      );
    if (
      !Array.isArray(record.implementations) ||
      record.implementations.length < 2
    ) {
      errors.push(
        `${name} is marked approved but lists ${record.implementations?.length ?? 0} implementations: the rule is two`,
      );
    }
  }
  const banner = /\*\*State: to-be-approved\.\*\*/.test(body);
  if (state === "to-be-approved" && !banner)
    errors.push(
      `${name}/SKILL.md must open with the "**State: to-be-approved.**" banner while approvals.json says so: a customer reads this file`,
    );
  if (state === "approved" && banner)
    errors.push(
      `${name}/SKILL.md still carries the to-be-approved banner but approvals.json says approved`,
    );
}

// approvals.json must not name a folder that is not an engine
for (const name of Object.keys(approvals)) {
  if (!exampleFolders.includes(name))
    errors.push(`approvals.json names "${name}", which is not a cookbook here`);
}

// A one-off skill's "## Part of" section may name cookbooks; they must exist.
for (const name of allSkillFolders) {
  if (exampleFolders.includes(name)) continue;
  const text = readFileSync(join(root, name, "SKILL.md"), "utf8");
  const part = text.match(/\n## Part of\n([\s\S]*?)(?=\n## |$)/);
  if (!part) continue;
  for (const m of part[1].matchAll(/`([a-z0-9-]+)`/g)) {
    if (!exampleFolders.includes(m[1]))
      errors.push(
        `${name}/SKILL.md says it is part of \`${m[1]}\`, which is not a cookbook here`,
      );
  }
}

if (errors.length) {
  console.error("cookbooks are out of sync:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`ok: ${exampleFolders.length} cookbooks, every one self-contained`);
