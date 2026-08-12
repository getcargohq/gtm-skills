/**
 * Validates every skill in this repo against the Cargo provider playbooks.
 *
 *   node scripts/validate.ts                          # fetch playbooks from GitHub
 *   node scripts/validate.ts --playbooks ../cargo-skills/cargo-gtm/provider-playbooks
 *   node scripts/validate.ts --ref v1.18.1            # pin to a tag/sha
 *
 * WHY THIS EXISTS
 *
 * These skills are the first contact a stranger has with Cargo. They run inside
 * an agent we do not control, with no session refresh to save them. A wrong
 * action slug or a stale credit cost does not degrade gracefully there — it
 * fails on a new user's first ever command, which is the worst possible moment.
 *
 * So the numbers are not trusted. Every `integrationSlug`/`actionSlug` pair in
 * every command is looked up in the corresponding playbook in
 * getcargohq/cargo-skills, and every credit figure in every cost table is
 * asserted against that playbook's own table. When a provider changes pricing
 * and someone updates the playbook upstream, this build goes red until the
 * markdown here agrees.
 *
 * The copy is yours to edit freely. The slugs and the numbers are not.
 *
 * Requires Node >= 22.18 (run as .ts via native type-stripping).
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const argValue = (flag: string) => {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : undefined;
};
const localPlaybooks = argValue("--playbooks");
const ref = argValue("--ref") ?? process.env.CARGO_SKILLS_REF ?? "main";
const rawBase = `https://raw.githubusercontent.com/getcargohq/cargo-skills/${ref}/cargo-gtm/provider-playbooks`;

const errors: string[] = [];
const fail = (skill: string, message: string) => errors.push(`${skill}: ${message}`);

/* ------------------------------------------------------------------ *
 * Playbooks — the upstream source of truth for slugs and prices.
 * ------------------------------------------------------------------ */

const playbookCache = new Map<string, Map<string, number> | null>();

/** `| \`slug\` | 0.02 | …` and `| \`slug\` | **0.1** | …` both parse. */
function parseCosts(markdown: string): Map<string, number> {
  const costs = new Map<string, number>();
  for (const line of markdown.split("\n")) {
    const row = /^\|\s*`([A-Za-z][A-Za-z0-9]*)`\s*\|([^|]+)\|/.exec(line);
    if (!row) continue;
    const price = /(\d+(?:\.\d+)?)/.exec(row[2].replace(/\*/g, ""));
    if (price) costs.set(row[1], Number(price[1]));
  }
  return costs;
}

async function playbook(integration: string): Promise<Map<string, number> | null> {
  if (playbookCache.has(integration)) return playbookCache.get(integration)!;

  let costs: Map<string, number> | null = null;
  if (localPlaybooks) {
    const path = join(localPlaybooks, `${integration}.md`);
    costs = existsSync(path) ? parseCosts(readFileSync(path, "utf8")) : null;
  } else {
    const response = await fetch(`${rawBase}/${integration}.md`);
    if (response.ok) {
      costs = parseCosts(await response.text());
    } else if (response.status !== 404) {
      throw new Error(
        `Could not fetch ${integration}.md from cargo-skills@${ref} (HTTP ${response.status}). ` +
          `Network problem, or the ref does not exist.`,
      );
    }
  }

  playbookCache.set(integration, costs);
  return costs;
}

/* ------------------------------------------------------------------ *
 * Skill parsing
 * ------------------------------------------------------------------ */

interface Skill {
  name: string;
  body: string;
  frontmatter: Record<string, string>;
  /** Every integration.action pair the commands actually call. */
  called: Set<string>;
  /** Every integration.action pair quoted in the cost table, with its price. */
  quoted: Map<string, number>;
}

function readSkill(name: string): Skill {
  const source = readFileSync(join(repoRoot, name, "SKILL.md"), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source);
  if (!match) {
    fail(name, "SKILL.md has no frontmatter block");
    return { name, body: source, frontmatter: {}, called: new Set(), quoted: new Map() };
  }

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const field = /^([a-z]+):\s*(.+)$/.exec(line);
    if (field) frontmatter[field[1]] = field[2].trim().replace(/^"|"$/g, "");
  }

  const body = match[2];

  const called = new Set(
    [...body.matchAll(/"integrationSlug":"([A-Za-z0-9]+)","actionSlug":"([A-Za-z0-9]+)"/g)].map(
      (m) => `${m[1]}.${m[2]}`,
    ),
  );

  const quoted = new Map<string, number>();
  for (const row of body.matchAll(/^\|\s*`([A-Za-z0-9]+)\.([A-Za-z0-9]+)`\s*\|\s*([\d.]+)/gm)) {
    quoted.set(`${row[1]}.${row[2]}`, Number(row[3]));
  }

  return { name, body, frontmatter, called, quoted };
}

/* ------------------------------------------------------------------ *
 * Checks
 * ------------------------------------------------------------------ */

/** Boilerplate every skill must carry. Substrings, so the prose around them stays free. */
const REQUIRED_BLOCKS: { label: string; needle: string }[] = [
  {
    label: "the deference guard (stops this competing with cargo-gtm when the full pack is installed)",
    needle: "If `cargo-gtm` is available",
  },
  {
    label: "the free-credits line (the reason a stranger can run this at all)",
    needle: "100 free credits",
  },
  {
    label: "the sample-before-you-spend rule",
    needle: "Never run this across a full list on the first attempt",
  },
  {
    label: "the CTA back to the full pack",
    needle: "npx skills add getcargohq/cargo-skills",
  },
  {
    // Pinned on the question, not on the `gh api` line: a skill that kept the
    // command and lost the question would still pass while quietly starring on
    // the user's behalf, which is the one outcome this section exists to prevent.
    label: "the star ask (the skill asks for the star — it never takes one)",
    needle: "Want me to star",
  },
];

async function checkSkill(skill: Skill): Promise<void> {
  const { name } = skill;

  if (skill.frontmatter.name !== name) {
    fail(name, `frontmatter name is \`${skill.frontmatter.name}\` but the directory is \`${name}\``);
  }
  if (!/^\d+\.\d+\.\d+$/.test(skill.frontmatter.version ?? "")) {
    fail(name, "frontmatter version must be MAJOR.MINOR.PATCH");
  }
  if (name.startsWith("cargo")) {
    fail(name, "must not start with `cargo` — these are named after the job, not the vendor");
  }

  const description = skill.frontmatter.description ?? "";
  if (!description.includes("Triggers:")) {
    fail(name, "description needs a `Triggers:` clause — it is the only text an agent sees before loading");
  }
  if (!description.includes("Skip when:")) {
    fail(name, "description needs a `Skip when:` clause or it competes with its neighbours for every prompt");
  }

  for (const block of REQUIRED_BLOCKS) {
    if (!skill.body.includes(block.needle)) fail(name, `missing ${block.label}`);
  }

  if (!skill.called.size) fail(name, "no connector action found in any command block");

  // `config` is always `{}`. Filters and per-call inputs go in `--data`, and
  // per-record inputs in `--records`. Stuffing them into `config` is silently
  // wrong: the call runs, ignores them, and returns an unfiltered result — the
  // exact shape of bug that burns someone on their first command.
  for (const action of skill.body.matchAll(/"kind":"connector"[^']*?"config":\{([^}]*)\}/g)) {
    if (action[1].trim()) {
      fail(
        name,
        `an action passes \`config:{${action[1].trim()}}\` — config must be \`{}\`; ` +
          `filters belong in --data, per-record inputs in --records`,
      );
    }
  }

  // A search action reads its filters from --data. Without one it returns an
  // arbitrary unfiltered page and bills for it.
  const SEARCH = /^(search|query|fetch)[A-Z]/;
  for (const pair of skill.called) {
    const action = pair.split(".")[1];
    if (SEARCH.test(action) && !/--data\s/.test(skill.body)) {
      fail(name, `\`${pair}\` is a search action but no command passes --data, so it has no filters`);
    }
  }

  for (const pair of skill.called) {
    if (!skill.quoted.has(pair)) {
      fail(name, `command calls \`${pair}\` but the cost table does not price it`);
    }
  }
  for (const pair of skill.quoted.keys()) {
    if (!skill.called.has(pair)) {
      fail(name, `cost table prices \`${pair}\` but no command calls it`);
    }
  }

  for (const [pair, price] of skill.quoted) {
    const [integration, action] = pair.split(".");
    const costs = await playbook(integration);
    if (!costs) {
      fail(name, `no playbook for \`${integration}\` upstream — check the provider slug`);
      continue;
    }
    const upstream = costs.get(action);
    if (upstream === undefined) {
      fail(name, `\`${pair}\` is not in that provider's playbook cost table — check the action slug`);
      continue;
    }
    if (upstream !== price) {
      fail(
        name,
        `\`${pair}\` costs ${upstream} upstream but this skill says ${price}. ` +
          `Update the cost table — and re-read the playbook, since pricing changes often come with shape changes.`,
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

const skillNames = readdirSync(repoRoot)
  .filter(
    (entry) =>
      statSync(join(repoRoot, entry), { throwIfNoEntry: false })?.isDirectory() &&
      existsSync(join(repoRoot, entry, "SKILL.md")),
  )
  .sort();

if (!skillNames.length) {
  console.error("No skills found — expected <name>/SKILL.md directories at the repo root.");
  process.exit(1);
}

const skills = skillNames.map(readSkill);

// Two skills claiming the same trigger phrase is the failure mode that degrades
// routing for the whole set, so it is an error rather than a warning.
const triggerOwners = new Map<string, string>();
for (const skill of skills) {
  const clause = /Triggers:\s*(.+?)\.\s*(?:Providers:|Skip when:)/.exec(skill.frontmatter.description ?? "");
  for (const quoted of clause?.[1].matchAll(/\\?"([^"\\]+)\\?"/g) ?? []) {
    const phrase = quoted[1].toLowerCase().trim();
    const owner = triggerOwners.get(phrase);
    if (owner && owner !== skill.name) {
      fail(skill.name, `trigger "${phrase}" is already claimed by \`${owner}\` — they will fight for the same prompts`);
    }
    triggerOwners.set(phrase, skill.name);
  }
}

for (const skill of skills) await checkSkill(skill);

const source = localPlaybooks ? localPlaybooks : `cargo-skills@${ref}`;

if (errors.length) {
  console.error(`\n${errors.length} problem${errors.length === 1 ? "" : "s"} (playbooks: ${source}):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error("");
  process.exit(1);
}

const actionCount = new Set(skills.flatMap((s) => [...s.called])).size;
console.log(
  `${skills.length} skills validated against ${source} — ` +
    `${actionCount} distinct actions, every slug and price confirmed.`,
);
