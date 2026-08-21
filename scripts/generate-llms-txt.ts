/**
 * Generates llms.txt from the actual skill tree.
 *
 *   node scripts/generate-llms-txt.ts          # write llms.txt
 *   node scripts/generate-llms-txt.ts --check  # CI: fail if stale
 *
 * llms.txt is how an LLM-facing crawler reads a repository without guessing at
 * its structure: one file, at a predictable path, listing what is here and what
 * each thing does. For a repo whose entire purpose is being *found*, a stale or
 * missing one is a self-inflicted wound — so it is generated from the skills
 * themselves and checked in CI rather than maintained by hand.
 *
 * Requires Node >= 22.18 (run as .ts via native type-stripping).
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(repoRoot, "llms.txt");
const repoUrl = "https://github.com/getcargohq/gtm-skills";
const packUrl = "https://github.com/getcargohq/cargo-skills";

interface Skill {
  name: string;
  description: string;
  /** First sentence of the description, without the trigger list. */
  job: string;
  path: string;
}

function loadSkills(): Skill[] {
  const skills: Skill[] = [];
  const walk = (dir: string, prefix = "") => {
    for (const entry of readdirSync(dir).sort()) {
      const absolute = join(dir, entry);
      if (
        !statSync(absolute, { throwIfNoEntry: false })?.isDirectory() ||
        entry.startsWith(".") ||
        entry === "node_modules"
      )
        continue;
      const relative = join(prefix, entry);
      const skillMd = join(absolute, "SKILL.md");
      if (!existsSync(skillMd)) {
        walk(absolute, relative);
        continue;
      }

      const frontmatter = /^---\n([\s\S]*?)\n---/.exec(
        readFileSync(skillMd, "utf8"),
      )?.[1];
      if (!frontmatter)
        throw new Error(`${entry}/SKILL.md has no frontmatter`);

      const parsed = parseYaml(frontmatter) as {
        name?: string;
        description?: string;
      };
      const name = parsed.name ?? "";
      const description = parsed.description ?? "";
      if (!name || !description)
        throw new Error(`${entry}/SKILL.md is missing name or description`);

      skills.push({
        name,
        description,
        job: description.split(/\.\s+Triggers:/)[0] + ".",
        path: relative,
      });
    }
  };
  walk(repoRoot);
  const duplicateNames = skills.filter(
    (skill, index) =>
      skills.findIndex((candidate) => candidate.name === skill.name) !== index,
  );
  if (duplicateNames.length > 0)
    throw new Error(
      `duplicate skill leaf names: ${[...new Set(duplicateNames.map((skill) => skill.name))].join(", ")}`,
    );
  return skills;
}

function render(skills: Skill[]): string {
  const lines = skills
    .map((s) => `- [${s.name}](${repoUrl}/blob/main/${s.path}/SKILL.md): ${s.description}`)
    .join("\n");

  const jobs = skills.map((s) => `- **${s.name}**: ${s.job}`).join("\n");

  return `# Cargo GTM Skills

> ${skills.length} agent skills for go-to-market work: finding B2B leads, building target account lists, resolving LinkedIn URLs, finding and verifying work emails, enriching companies and people, mapping buying committees, and tracking job changes, funding rounds, and tech-stack signals. Each has one routed job and installs on its own. Some carry a worked CDK example instead of a command: the same job as a deployed pipeline that keeps running, which your agent adapts into your project. Powered by [Cargo](https://getcargo.ai).

## Install

All of them:

\`\`\`bash
npx skills add getcargohq/gtm-skills --all --full-depth
\`\`\`

Or exactly one:

\`\`\`bash
npx skills add getcargohq/gtm-skills/<skill-name>
\`\`\`

Then sign in. This creates the account and workspace on first use, with no browser and no separate sign-up step:

\`\`\`bash
npm install -g @cargo-ai/cli
cargo-ai login --email you@company.com          # sends a code, then exits
cargo-ai login --email you@company.com --code 123456
\`\`\`

A new account starts with **100 free credits and needs no card**: roughly 5,000 leads sourced, or 1,000 profile-plus-verified-email enrichments. Every skill here runs end to end inside that balance, so there is no purchase gate between installing one and getting a real result.

## Skills

${lines}

## What each one does

${jobs}

## The full pack

These are single-job slices. The complete [Cargo skills pack](${packUrl}) is 17 skills covering the whole CLI: workflow orchestration, storage and segmentation, agents and RAG, workspace-as-code, diagnostics, and billing, with recipes, per-provider playbooks, and cost discipline built in:

\`\`\`bash
npx skills add getcargohq/cargo-skills
\`\`\`

Install the pack *or* these, not both: each skill here defers to \`cargo-gtm\` when the pack is present.

## Documentation

- [Cargo](https://getcargo.ai)
- [Cargo API docs](https://docs.getcargo.ai/api-reference/introduction)
- [Full skills pack](${packUrl})
- [This repository](${repoUrl})

<!-- Generated by scripts/generate-llms-txt.ts. Do not edit by hand. -->
`;
}

const generated = render(loadSkills());

if (process.argv.includes("--check")) {
  const current = existsSync(outPath) ? readFileSync(outPath, "utf8") : "";
  if (current !== generated) {
    console.error("llms.txt is stale. Regenerate with: node scripts/generate-llms-txt.ts");
    process.exit(1);
  }
  console.log("llms.txt is up to date.");
} else {
  writeFileSync(outPath, generated);
  console.log(`Wrote ${outPath}`);
}
