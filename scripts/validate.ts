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

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { basename, join, dirname, resolve } from "node:path";
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
    // The plugin channel's session hooks write the same `[gtm-skills: …]` marker
    // onto the real session row. Without this gate a plugin user produces two
    // rows for one session and the attribution query counts the skill twice —
    // silently, and in the direction that flatters it.
    label: "the attribution guard (skips the manual session row when the plugin's hooks write one)",
    needle: '"cargo@gtm"',
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
 * Plugin channel — the manifests, hooks, and pin that ship the same
 * skills to Claude Code / Codex / Cursor as a native plugin.
 * ------------------------------------------------------------------ */

/** Reads a JSON file, recording a parse failure rather than throwing. */
function readJson(relative: string): Record<string, any> | null {
  const path = join(repoRoot, relative);
  if (!existsSync(path)) {
    fail("plugin", `${relative} is missing — the plugin channel needs it on every target`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail("plugin", `${relative} is not valid JSON: ${(error as Error).message}`);
    return null;
  }
}

async function checkPluginChannel(skillNames: string[]): Promise<void> {
  const claude = readJson(".claude-plugin/plugin.json");
  const claudeMarket = readJson(".claude-plugin/marketplace.json");
  const codex = readJson(".codex-plugin/plugin.json");
  const codexMarket = readJson(".agents/plugins/marketplace.json");
  const cursor = readJson(".cursor-plugin/plugin.json");
  const cursorMarket = readJson(".cursor-plugin/marketplace.json");
  const root = readJson("plugin.json");

  // One source, three targets. A version that only moved on one of them ships a
  // plugin that reports a different version depending on where it was installed.
  const versions = new Map<string, string>();
  for (const [label, manifest] of [
    [".claude-plugin/plugin.json", claude],
    [".codex-plugin/plugin.json", codex],
    [".cursor-plugin/plugin.json", cursor],
    ["plugin.json", root],
  ] as const) {
    if (!manifest) continue;
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) {
      fail("plugin", `${label} version must be MAJOR.MINOR.PATCH`);
      continue;
    }
    versions.set(label, manifest.version);
  }
  const distinct = new Set(versions.values());
  if (distinct.size > 1) {
    const detail = [...versions].map(([label, v]) => `${label}=${v}`).join(", ");
    fail("plugin", `manifest versions disagree (${detail}) — bump them together`);
  }

  // The plugin id a user types is `<plugin>@<marketplace>`. The plugin half is
  // `cargo` on every Cargo product — the pack installs as `cargo@cargo`, this
  // one as `cargo@gtm` — so the MARKETPLACE half is what has to differ, and it
  // must not be `cargo`: two marketplaces sharing one name cannot both be added.
  //
  // The shared plugin name is also why hooks/lifecycle-guard.sh matches the
  // pack on `…@cargo` rather than on a `cargo@` prefix, which would match this
  // plugin's own id.
  for (const [label, manifest] of [
    [".claude-plugin/marketplace.json", claudeMarket],
    [".cursor-plugin/marketplace.json", cursorMarket],
    [".agents/plugins/marketplace.json", codexMarket],
  ] as const) {
    if (!manifest) continue;
    if (manifest.name !== "gtm") {
      fail("plugin", `${label} marketplace name is \`${manifest.name}\` — must be \`gtm\` (\`cargo\` belongs to the pack)`);
    }
    const entries: any[] = manifest.plugins ?? [];
    if (entries.length !== 1 || entries[0]?.name !== "cargo") {
      fail("plugin", `${label} must list exactly one plugin named \`cargo\` — the install id is \`cargo@gtm\``);
    }
  }
  for (const [label, manifest] of [
    [".claude-plugin/plugin.json", claude],
    [".codex-plugin/plugin.json", codex],
    [".cursor-plugin/plugin.json", cursor],
    ["plugin.json", root],
  ] as const) {
    if (manifest && manifest.name !== "cargo") {
      fail("plugin", `${label} plugin name is \`${manifest.name}\` — must be \`cargo\`, same as the pack's`);
    }
  }

  // Validate the actual root component inventory instead of trusting a
  // description count that can stay correct while a plugin exposes fewer skills.
  for (const [label, manifest] of [
    [".claude-plugin/plugin.json", claude],
    [".codex-plugin/plugin.json", codex],
    [".cursor-plugin/plugin.json", cursor],
  ] as const) {
    if (!manifest) continue;
    const declared = Array.isArray(manifest.skills)
      ? manifest.skills
      : [manifest.skills];
    const discovered = new Set<string>();
    for (const relative of declared) {
      if (typeof relative !== "string") {
        fail("plugin", `${label} has a non-string skill path`);
        continue;
      }
      const absolute = resolve(repoRoot, relative);
      if (!existsSync(absolute)) {
        fail("plugin", `${label} skill path does not exist: ${relative}`);
        continue;
      }
      if (existsSync(join(absolute, "SKILL.md"))) {
        discovered.add(basename(absolute));
        continue;
      }
      for (const entry of readdirSync(absolute, { withFileTypes: true })) {
        if (
          entry.isDirectory() &&
          existsSync(join(absolute, entry.name, "SKILL.md"))
        )
          discovered.add(entry.name);
      }
    }
    const missing = skillNames.filter((name) => !discovered.has(name));
    const extra = [...discovered].filter((name) => !skillNames.includes(name));
    if (missing.length > 0)
      fail("plugin", `${label} does not expose ${missing.join(", ")}`);
    if (extra.length > 0)
      fail("plugin", `${label} exposes unknown skills: ${extra.join(", ")}`);
  }

  // Every hook a manifest wires must exist and be executable. A plugin that
  // points at a missing or non-executable script fails at session start, on the
  // user's machine, with no output anyone sees.
  const hookRefs = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "string") {
      for (const m of value.matchAll(/hooks\/[A-Za-z0-9._-]+/g)) hookRefs.add(m[0]);
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(collect);
    }
  };
  collect(claude?.hooks);
  collect(codex?.hooks);
  collect(cursor?.hooks);
  collect(readJson("hooks/codex-hooks.json"));
  collect(readJson("hooks/cursor-hooks.json"));
  for (const hookPath of [...hookRefs].sort()) {
    const abs = join(repoRoot, hookPath);
    if (!existsSync(abs)) {
      fail("plugin", `a manifest wires \`${hookPath}\` but the file does not exist`);
      continue;
    }
    // 0o111 — any execute bit, and only for the scripts (the per-target
    // *-hooks.json files are config that the agent reads, not runs). Git tracks
    // the mode, so a script committed without it is broken for everyone who
    // installs the plugin.
    if (hookPath.endsWith(".sh") && !(statSync(abs).mode & 0o111)) {
      fail("plugin", `\`${hookPath}\` is not executable (chmod +x, then commit the mode)`);
    }
  }

  // The session hooks install this exact CLI version, so it has to be a version.
  const pin = existsSync(join(repoRoot, "cli-version"))
    ? readFileSync(join(repoRoot, "cli-version"), "utf8").trim()
    : "";
  if (!/^\d+\.\d+\.\d+$/.test(pin)) {
    fail("plugin", "cli-version must hold a bare MAJOR.MINOR.PATCH — the session hook installs it verbatim");
  }

  // The skill-load detector runs against a transcript, not a checkout, so its
  // name list is embedded. A skill added to the tree but not to that list is
  // invisible in the attribution query — the one number this repo exists to
  // produce — and nothing else would catch it.
  const detector = join(repoRoot, "hooks/skill-loads.sh");
  if (existsSync(detector)) {
    const listed = /# BEGIN SKILL LIST[\s\S]*?SKILL_NAMES="([^"]*)"/.exec(readFileSync(detector, "utf8"));
    if (!listed) {
      fail("plugin", "hooks/skill-loads.sh has no SKILL_NAMES list between its BEGIN/END markers");
    } else {
      const have = listed[1].trim().split(/\s+/).sort();
      const want = [...skillNames].sort();
      const missing = want.filter((n) => !have.includes(n));
      const extra = have.filter((n) => !want.includes(n));
      if (missing.length) {
        fail("plugin", `hooks/skill-loads.sh does not list ${missing.join(", ")} — those sessions would report no skill`);
      }
      if (extra.length) {
        fail("plugin", `hooks/skill-loads.sh lists ${extra.join(", ")}, which is not a skill directory`);
      }
    }
  }

  // Every skill grouped exactly once on skills.sh, or the listing quietly drops
  // whichever one was forgotten to the bottom.
  const groups = readJson("skills.sh.json");
  if (groups) {
    const grouped = (groups.groupings ?? []).flatMap((g: any) => g.skills ?? []);
    const seen = new Set<string>();
    for (const name of grouped) {
      if (seen.has(name)) fail("plugin", `skills.sh.json groups \`${name}\` twice`);
      seen.add(name);
      if (!skillNames.includes(name)) fail("plugin", `skills.sh.json groups \`${name}\`, which is not a skill directory`);
    }
    for (const name of skillNames) {
      if (!seen.has(name)) fail("plugin", `skills.sh.json does not group \`${name}\``);
    }
  }

  // Counts written by hand go stale the moment a skill is added, and a wrong
  // one is not a typo — the badge is the first thing on the page and the
  // manifest description is what a plugin listing shows. The pack learned this
  // with a hand-listed skill table that fell two behind the tree.
  const count = skillNames.length;
  const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
  for (const [what, pattern] of [
    ["the skills.sh badge", /skills\.sh-(\d+)%20skills/],
    ["the opening line", /(\d+) agent skills/],
  ] as const) {
    const found = pattern.exec(readme);
    if (!found) {
      fail("plugin", `README.md no longer contains ${what}: the count check cannot run`);
    } else if (Number(found[1]) !== count) {
      fail("plugin", `${what} says ${found[1]} skills, but there are ${count}`);
    }
  }

  // Same count, spelled out, in the description every plugin listing displays.
  const WORDS = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
    "twenty-one",
    "twenty-two",
    "twenty-three",
    "twenty-four",
  ];
  const spelled = WORDS[count];
  for (const [label, manifest] of [
    [".claude-plugin/plugin.json", claude],
    [".codex-plugin/plugin.json", codex],
    [".cursor-plugin/plugin.json", cursor],
    [".claude-plugin/marketplace.json", claudeMarket],
    [".cursor-plugin/marketplace.json", cursorMarket],
    [".agents/plugins/marketplace.json", codexMarket],
  ] as const) {
    if (!manifest) continue;
    const text = JSON.stringify(manifest);
    const spoken = /\b([a-z]+(?:-[a-z]+)?) routed GTM skills/i.exec(text);
    if (spoken && spelled && spoken[1].toLowerCase() !== spelled) {
      fail("plugin", `${label} says "${spoken[1]} routed GTM skills" but there are ${count} (${spelled})`);
    }
  }

  // The badge links to LICENSE, and plugin.json declares MIT. A repo that
  // claims a license without shipping its text renders the badge as "unknown"
  // and leaves the claim unbacked.
  if (!existsSync(join(repoRoot, "LICENSE"))) {
    fail("plugin", "LICENSE is missing, but plugin.json declares a license and README links to it");
  }

  // The committed archive is what was (or will be) uploaded to the OpenAI
  // directory, and that channel does not self-update: the listing keeps serving
  // whatever version was reviewed. So a zip left behind at an older version than
  // the manifest is not stale build output, it is a claim about what is live
  // that has quietly stopped being true. Rebuild it (scripts/build-codex-package.mjs)
  // when the version moves.
  const archive = join(repoRoot, "dist/gtm-skills-codex.zip");
  if (existsSync(archive) && claude?.version) {
    try {
      const packaged = JSON.parse(
        execFileSync("unzip", ["-p", archive, ".codex-plugin/plugin.json"], {
          encoding: "utf8",
        }),
      );
      if (packaged.version !== claude.version) {
        fail(
          "plugin",
          `dist/gtm-skills-codex.zip packages version ${packaged.version} but the manifests say ${claude.version} — rebuild it before submitting`,
        );
      }
    } catch (error) {
      fail("plugin", `dist/gtm-skills-codex.zip could not be read: ${(error as Error).message}`);
    }
  }

  // The approval hook is the security-relevant surface, and it is a VERBATIM
  // copy of the pack's. Keeping it byte-identical is the whole maintenance
  // strategy: a fix reviewed once upstream reaches both plugins, and a local
  // "improvement" here would be an unreviewed fork of an allowlist. Compared
  // against the same ref as the playbooks.
  const localHook = join(repoRoot, "hooks/approve-cli.sh");
  if (existsSync(localHook)) {
    const mine = readFileSync(localHook, "utf8");
    let upstream: string | null = null;
    if (localPlaybooks) {
      const sibling = resolve(localPlaybooks, "../../hooks/approve-cli.sh");
      upstream = existsSync(sibling) ? readFileSync(sibling, "utf8") : null;
    } else {
      const response = await fetch(
        `https://raw.githubusercontent.com/getcargohq/cargo-skills/${ref}/hooks/approve-cli.sh`,
      );
      if (response.ok) upstream = await response.text();
      else if (response.status !== 404) {
        throw new Error(`Could not fetch hooks/approve-cli.sh from cargo-skills@${ref} (HTTP ${response.status}).`);
      }
    }
    if (upstream === null) {
      console.warn("  ! could not read the upstream approve-cli.sh — drift check skipped");
    } else if (upstream !== mine) {
      fail(
        "plugin",
        "hooks/approve-cli.sh has drifted from the pack's copy. Re-copy it verbatim; " +
          "changes to the allowlist belong upstream in getcargohq/cargo-skills, where they get reviewed once for both plugins.",
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

// Every skill declares what kind of thing it is in `metadata.source`, and
// there are exactly two kinds:
//
//   one-off   a job an agent runs in a turn: the exact cargo-ai command, its
//             price, the star ask. Validated here, against the playbooks.
//   cookbook  a worked CDK example an agent adapts into a project and deploys.
//             Names no connector action, prices no call. Validated by
//             scripts/check-cookbooks.mjs.
//
// Both kinds take part in the trigger-collision check below, because a
// one-off and a cookbook compete for the same prompts and that is exactly the
// seam that must not blur ("build a TAM list" vs "keep our TAM current").
//
// The frontmatter reader above is flat on purpose (top-level keys only), so
// the nested marker is read straight from the file. A missing or unknown
// value is an error, not a default: a typo must not silently make a cookbook
// a one-off.
const SOURCES = new Set(["one-off", "cookbook"]);
const allSkills = skillNames.map(readSkill);
const sourceOf = (skill: Skill): string | undefined =>
  /^\s+source:\s*([a-z-]+)\s*$/m.exec(
    readFileSync(join(repoRoot, skill.name, "SKILL.md"), "utf8").split(
      /\n---\n/,
    )[0] ?? "",
  )?.[1];
for (const skill of allSkills) {
  const source = sourceOf(skill);
  if (source === undefined || !SOURCES.has(source)) {
    fail(
      skill.name,
      `metadata.source must be one of ${[...SOURCES].join(" | ")} (got ${source === undefined ? "nothing" : `\`${source}\``}) — it says what kind of skill this is`,
    );
  }
}
const skills = allSkills.filter((skill) => sourceOf(skill) !== "cookbook");

// Two skills claiming the same trigger phrase is the failure mode that degrades
// routing for the whole set, so it is an error rather than a warning.
const triggerOwners = new Map<string, string>();
for (const skill of allSkills) {
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

await checkPluginChannel(skillNames);

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
    `${actionCount} distinct actions, every slug and price confirmed. ` +
    `Plugin channel (Claude Code, Codex, Cursor) consistent.`,
);
