#!/usr/bin/env node
// Grades the cookbook SKILL.md descriptions with cargo-skills' routing eval.
//
// WHY IT NEEDS BOTH REPOS. The question a cookbook description has to answer is
// not "does it beat the other cookbooks" — it is "does it beat cargo-gtm". The
// seam is one-off vs standing: "build me a TAM" belongs to cargo-gtm when
// someone wants a list today and to tam-building when they want a pipeline that
// keeps it current. Grading the cookbooks alone ranks 3 descriptions against
// each other and reports nonsense, because the skill that SHOULD win half the
// cases is not in the room.
//
// routing-eval.ts takes one --skills-root and discovers `<root>/*/SKILL.md`, so
// this builds a temporary root of symlinks into both repos and grades against
// that. Extra arguments pass straight through (--verbose, --llm, --llm-min=90).
//
//   node scripts/routing-eval.mjs
//   node scripts/routing-eval.mjs --llm --llm-min=90     # needs ANTHROPIC_API_KEY
//   CARGO_SKILLS_ROOT=../cargo-skills node scripts/routing-eval.mjs
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = resolve(
  root,
  process.env.CARGO_SKILLS_ROOT ?? "../cargo-skills",
);
const grader = join(skillsRoot, ".github/scripts/routing-eval.ts");

if (!existsSync(grader)) {
  console.log(
    `skipped: routing evals need a cargo-skills checkout beside this repo (looked in ${skillsRoot}).\n` +
      `         git clone https://github.com/getcargohq/cargo-skills ../cargo-skills\n` +
      `         or set CARGO_SKILLS_ROOT.`,
  );
  process.exit(0);
}

const skillDirs = (base) =>
  readdirSync(base).filter(
    (entry) =>
      !entry.startsWith(".") && existsSync(join(base, entry, "SKILL.md")),
  );

const combined = mkdtempSync(join(tmpdir(), "cookbook-routing-"));
try {
  for (const [base, label] of [
    [skillsRoot, "cargo-skills"],
    [root, "cargo-cookbooks"],
  ]) {
    for (const entry of skillDirs(base)) {
      const link = join(combined, entry);
      if (existsSync(link)) {
        console.error(
          `name collision: "${entry}" exists in both repos (second seen in ${label})`,
        );
        process.exit(1);
      }
      symlinkSync(join(base, entry), link);
    }
  }

  execFileSync(
    process.execPath,
    [
      grader,
      "--skills-root",
      combined,
      "--cases",
      join(root, "evals/routing.jsonl"),
      ...process.argv.slice(2),
    ],
    { stdio: "inherit" },
  );
} finally {
  rmSync(combined, { recursive: true, force: true });
}
