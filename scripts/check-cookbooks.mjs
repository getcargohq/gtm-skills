#!/usr/bin/env node
// Validates the skill layer: cookbook.json (the data an installer reads) and
// SKILL.md (the description an agent routes on). Sibling of check-scaffold.mjs,
// which owns the `--from` dependency graph; this owns everything stacked on it.
//
// Dependency-free on purpose, like its sibling: it must run on a bare clone
// with `npm ci --ignore-scripts` and no workspace.
//
// The rules, and why each exists:
//   - slug == folder, and no `requires` key: the dependency graph lives once,
//     in cargo.scaffold.json. Two copies of a fact can disagree.
//   - kind: outcome carries a SKILL.md; kind: foundation must not. base-gtm and
//     crm-sync define no motion of their own, and a skill for them would
//     compete for prompts it cannot serve.
//   - descriptions carry Triggers and Skip when: the description is the only
//     text an agent weighs before loading a skill, and the negative case is
//     what stops the wrong one loading. Graded properly by cargo-skills'
//     routing-eval.ts; this is the cheap structural half.
//   - inputs[].file resolves, and a file outside the folder belongs to a
//     required sibling: an input pointing at a file the scaffold will not pull
//     is an interview question nobody can answer.
//   - approved needs its evidence: a fresh-workspace date AND two
//     implementations. The approval rule is the one thing standing between a
//     launch post and a claim nobody tested.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const notes = [];

const scaffold = JSON.parse(
  readFileSync(join(root, "cargo.scaffold.json"), "utf8"),
);
const folders = scaffold.folders ?? {};
const declared = Object.keys(folders);

// Transitive requires closure, so an input may point at a file in a sibling the
// scaffold will actually pull.
const closure = (name, seen = new Set()) => {
  for (const req of folders[name]?.requires ?? []) {
    if (seen.has(req)) continue;
    seen.add(req);
    closure(req, seen);
  }
  return seen;
};

// Minimal frontmatter reader: enough for `name` and `description`, which are
// the only two fields this gate judges.
const frontmatter = (text) => {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const block = text.slice(4, end);
  const read = (key) => {
    const m = block.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
    if (!m) return null;
    return m[1].trim().replace(/^"(.*)"$/s, "$1");
  };
  return { name: read("name"), description: read("description") };
};

const INPUT_KINDS = new Set(["value", "generated", "env", "manual"]);

for (const name of declared) {
  const dir = join(root, name);
  const bookPath = join(dir, "cookbook.json");
  const skillPath = join(dir, "SKILL.md");

  if (!existsSync(bookPath)) {
    // Rollout is deliberately incremental: a folder without cookbook.json is
    // not yet in the skill layer. Reported, never failed, so the remaining work
    // is visible on every run instead of tracked somewhere else.
    notes.push(name);
    continue;
  }

  let book;
  try {
    book = JSON.parse(readFileSync(bookPath, "utf8"));
  } catch (e) {
    errors.push(`${name}/cookbook.json is not valid JSON: ${e.message}`);
    continue;
  }

  if (book.slug !== name) {
    errors.push(
      `${name}/cookbook.json slug is "${book.slug}", expected "${name}"`,
    );
  }
  if ("requires" in book) {
    errors.push(
      `${name}/cookbook.json carries a "requires" key: that fact lives only in cargo.scaffold.json`,
    );
  }
  if (!["outcome", "foundation"].includes(book.kind)) {
    errors.push(`${name}/cookbook.json kind must be "outcome" or "foundation"`);
  }
  if (!["to-be-approved", "approved"].includes(book.state)) {
    errors.push(
      `${name}/cookbook.json state must be "to-be-approved" or "approved"`,
    );
  }
  if (!book.outcome || book.outcome.length < 20) {
    errors.push(
      `${name}/cookbook.json needs an "outcome" line a user would recognise`,
    );
  }
  if (!Array.isArray(book.doneWhen) || book.doneWhen.length === 0) {
    errors.push(
      `${name}/cookbook.json needs at least one doneWhen check: it is the acceptance test`,
    );
  }

  // The approval rule, enforced rather than remembered.
  if (book.state === "approved") {
    const a = book.approval ?? {};
    if (!a.demoWorkspace) {
      errors.push(
        `${name} is marked approved but has no approval.demoWorkspace date`,
      );
    }
    if (!Array.isArray(a.implementations) || a.implementations.length < 2) {
      errors.push(
        `${name} is marked approved but lists ${a.implementations?.length ?? 0} implementations: the rule is two`,
      );
    }
  }

  // Inputs must point at files the scaffold will actually pull.
  const reachable = closure(name).add(name);
  for (const input of book.inputs ?? []) {
    const where = `${name}/cookbook.json input "${input.id}"`;
    if (!INPUT_KINDS.has(input.kind)) {
      errors.push(
        `${where} has kind "${input.kind}", expected one of ${[...INPUT_KINDS].join(", ")}`,
      );
    }
    if (!input.ask)
      errors.push(
        `${where} has no "ask": every input is answerable or it is not an input`,
      );
    if (input.kind === "env" && !input.env) {
      errors.push(`${where} is kind env but names no variable`);
    }
    if (input.file) {
      if (!existsSync(join(root, input.file))) {
        errors.push(`${where} points at "${input.file}", which does not exist`);
      }
      const owner = input.file.split("/")[0];
      if (!reachable.has(owner)) {
        errors.push(
          `${where} points into "${owner}", which "${name}" does not require: the scaffold will not pull it`,
        );
      }
    }
    if (input.kind === "value" && !input.file) {
      errors.push(`${where} is kind value but names no file to patch`);
    }
  }

  // Foundations define no motion, so they carry no skill. Outcomes must.
  const hasSkill = existsSync(skillPath);
  if (book.kind === "outcome" && !hasSkill) {
    errors.push(`${name} is an outcome cookbook and needs a SKILL.md`);
  }
  if (book.kind === "foundation" && hasSkill) {
    errors.push(
      `${name} is a foundation cookbook and must not carry a SKILL.md: it would compete for prompts it cannot serve`,
    );
  }

  if (hasSkill) {
    const fm = frontmatter(readFileSync(skillPath, "utf8"));
    if (!fm) {
      errors.push(`${name}/SKILL.md has no YAML frontmatter`);
    } else {
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
      if (d && !/Triggers:/.test(d)) {
        errors.push(
          `${name}/SKILL.md description carries no "Triggers:" clause`,
        );
      }
      if (d && !/Skip when:/.test(d)) {
        errors.push(
          `${name}/SKILL.md description carries no "Skip when:" clause`,
        );
      }
    }
  }
}

// A SKILL.md in a folder with no cookbook.json is a skill with no data behind it.
for (const entry of readdirSync(root)) {
  if (entry.startsWith(".") || entry === "deploy-cookbook") continue;
  const dir = join(root, entry);
  if (!statSync(dir).isDirectory()) continue;
  if (
    existsSync(join(dir, "SKILL.md")) &&
    !existsSync(join(dir, "cookbook.json"))
  ) {
    errors.push(`${entry}/SKILL.md exists with no cookbook.json beside it`);
  }
}

if (!existsSync(join(root, "deploy-cookbook", "SKILL.md"))) {
  errors.push(
    "deploy-cookbook/SKILL.md is missing: it is the procedure every cookbook skill defers to",
  );
}

if (errors.length) {
  console.error("cookbook skill layer is out of sync:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const done = declared.length - notes.length;
console.log(`ok: ${done}/${declared.length} cookbooks carry a cookbook.json`);
if (notes.length) {
  console.log(`   still to convert: ${notes.join(", ")}`);
}
