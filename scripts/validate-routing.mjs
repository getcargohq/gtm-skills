#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evaluatorCandidates = [
  join(root, ".cargo-skills", ".github", "scripts", "routing-eval.ts"),
  resolve(root, "..", "cargo-skills", ".github", "scripts", "routing-eval.ts"),
];
const evaluator = evaluatorCandidates.find(existsSync);

if (!evaluator) {
  throw new Error(
    "Routing evaluator not found. Check out getcargohq/cargo-skills at .cargo-skills or ../cargo-skills.",
  );
}

const skillFolders = (dir = root) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (
      !entry.isDirectory() ||
      entry.name.startsWith(".") ||
      entry.name === "node_modules"
    )
      return [];
    const absolute = join(dir, entry.name);
    return existsSync(join(absolute, "SKILL.md"))
      ? [absolute]
      : skillFolders(absolute);
  });

const stage = mkdtempSync(join(tmpdir(), "gtm-skills-routing-"));
try {
  const names = new Set();
  for (const folder of skillFolders()) {
    const name = basename(folder);
    if (names.has(name)) throw new Error(`Duplicate skill leaf name: ${name}`);
    names.add(name);
    symlinkSync(folder, join(stage, name), "dir");
  }

  execFileSync(
    process.execPath,
    [
      evaluator,
      "--skills-root",
      stage,
      "--cases",
      join(root, "evals", "routing.jsonl"),
    ],
    { stdio: "inherit" },
  );
} finally {
  rmSync(stage, { recursive: true, force: true });
}
