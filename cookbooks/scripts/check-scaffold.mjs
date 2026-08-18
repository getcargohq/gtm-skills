#!/usr/bin/env node
// Validates cargo.scaffold.json against the repo on disk. This is the one gate
// that runs on a bare clone (no workspace, no generated .cargo-ai types), so it
// guards the invariants `cargo-cdk init --from` relies on:
//   - every declared cookbook folder exists and has a README
//   - every `requires` edge points at a declared cookbook
//   - the require graph is acyclic
//   - every cookbook folder on disk is declared (new ones can't be forgotten)
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const scaffoldPath = join(root, "cargo.scaffold.json");
if (!existsSync(scaffoldPath)) {
  console.error("cargo.scaffold.json not found");
  process.exit(1);
}

const scaffold = JSON.parse(readFileSync(scaffoldPath, "utf8"));
const folders = scaffold.folders ?? {};
const declared = new Set(Object.keys(folders));

// Shared root files listed in the scaffold must exist.
for (const file of scaffold.shared ?? []) {
  if (!existsSync(join(root, file))) {
    errors.push(`scaffold.shared lists "${file}" but it does not exist`);
  }
}

// Each declared folder must exist, be a directory, and carry a README.
for (const name of declared) {
  const dir = join(root, name);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    errors.push(`folder "${name}" is declared but is not a directory`);
    continue;
  }
  if (!existsSync(join(dir, "README.md"))) {
    errors.push(`folder "${name}" is missing a README.md`);
  }
  for (const req of folders[name].requires ?? []) {
    if (!declared.has(req)) {
      errors.push(`folder "${name}" requires "${req}", which is not declared`);
    }
  }
  // `kind` sits beside `requires` because both are facts about the folder. The
  // CLI's schema strips unknown keys, so this is ours alone to enforce.
  if (!["outcome", "foundation"].includes(folders[name].kind)) {
    errors.push(
      `folder "${name}" needs kind: "outcome" or "foundation" (foundations define no motion and carry no skill)`,
    );
  }
}

// Every cookbook directory on disk (a top-level dir with a README) must be
// declared, so a newly added cookbook can't silently drop out of `--from`.
const ignore = new Set(["node_modules", "scripts", ".github", ".cargo-ai"]);
for (const entry of readdirSync(root)) {
  if (entry.startsWith(".") || ignore.has(entry)) continue;
  const dir = join(root, entry);
  if (!statSync(dir).isDirectory()) continue;
  if (existsSync(join(dir, "README.md")) && !declared.has(entry)) {
    errors.push(
      `cookbook folder "${entry}" exists but is not in cargo.scaffold.json`,
    );
  }
}

// Detect cycles in the requires graph.
const state = new Map(); // 0 = visiting, 1 = done
const visit = (name, trail) => {
  if (state.get(name) === 1) return;
  if (state.get(name) === 0) {
    errors.push(`requires cycle: ${[...trail, name].join(" -> ")}`);
    return;
  }
  state.set(name, 0);
  for (const req of folders[name]?.requires ?? []) {
    if (declared.has(req)) visit(req, [...trail, name]);
  }
  state.set(name, 1);
};
for (const name of declared) visit(name, []);

if (errors.length) {
  console.error("cargo.scaffold.json is out of sync:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `ok: ${declared.size} cookbooks validated against cargo.scaffold.json`,
);
