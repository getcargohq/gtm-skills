#!/usr/bin/env node
// build-codex-package.mjs — build the uploadable plugin archive for the
// OpenAI Plugins Directory (ChatGPT + Codex).
//
// Why this exists: every other channel tracks this repo on its own. skills.sh
// crawls it, ClawHub publishes on push to main, and the plugin marketplaces
// pull from the default branch. The OpenAI directory does not — its docs are
// explicit that "published plugins do not update those skills live". It is a
// submission-time snapshot, and every change needs a new version, a fresh
// review, and a manual publish.
//
// So the archive has to be reproducible rather than hand-assembled, or the one
// listing that cannot self-update becomes the one nobody can rebuild.
//
//   node scripts/build-codex-package.mjs           # -> dist/gtm-skills-codex.zip
//   node scripts/build-codex-package.mjs --out DIR
//
// Ported from getcargohq/cargo-skills' .github/scripts/build-codex-package.mjs,
// which packages the full pack for the same directory. Two deliberate
// divergences, both noted at their site: SHORT_DESCRIPTIONS starts empty (no
// skill here is over the limit yet), and the icon is measured by reading the
// PNG header rather than by shelling out to `sips`, so this runs in CI on Linux
// and not only on a maintainer's Mac.
//
// The archive layout follows OpenAI's documented convention, which differs from
// this repo's on one point: skills live under `skills/`, not at the package
// root, so the manifest says `"skills": "./skills/"` rather than the repo's
// `"./"`.
//
// Skills-only on purpose: the upload dialog asks for a skills-only plugin, and
// `hooks/codex-hooks.json` invokes `${CLAUDE_PLUGIN_ROOT}` — a Claude Code
// variable — so bundling hooks here would ship an unverified path into review.
//
// Rules the OpenAI validator enforces that no other channel does, normalised
// here so the repo keeps serving the channels that want the fuller form:
//
//   - Skill `description` capped at 1024 characters.
//   - No `metadata` in SKILL.md frontmatter. Ours carries OpenClaw install
//     directives, which mean nothing to OpenAI, so the block is dropped from
//     the packaged copy only.
//   - `interface` needs displayName, shortDescription, and two square icons.
//
// The rest of the checks below exist because there is no submission API — the
// portal is the only path, every version is human-reviewed, and a rejection
// costs a whole review cycle. So every documented rule is asserted at build
// time instead. Note LIMITS targets the stricter of the two published tiers.

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Two tiers of validation exist and they disagree. The uploader enforces the
// looser "package" limits; the final directory submission enforces much tighter
// ones on the same fields. Building to the package limits gets you an accepted
// archive that is rejected later, so everything here targets the STRICTER tier.
// https://developers.openai.com/plugins/deploy/submission-errors
const LIMITS = {
  pluginName: 64,
  pluginDescription: 1024,
  authorName: 120,
  displayName: 30, // package allows 80
  shortDescription: 30, // package allows 240
  skillDescription: 1024,
  skillIdentity: 64, // "plugin-name:skill-name"
  archiveEntries: 5000,
  archiveBytes: 100 * 1024 * 1024,
  iconMinPx: 48,
  iconMaxPx: 4096,
  iconBytes: 5 * 1024 * 1024,
  pathSegments: 20,
};

const SKILL_DESCRIPTION_LIMIT = LIMITS.skillDescription;

// Rewrites for skills whose repo description exceeds OpenAI's limit. Empty on
// purpose: every description here currently fits, and the skills are deliberately
// short. Kept as the mechanism rather than deleted, because the alternative when
// one does go long is a silent truncation into a rejected upload — anything over
// the limit without an entry here fails the build. Rewrites, never truncations:
// a trigger phrase cut in half is worse than no entry at all.
const SHORT_DESCRIPTIONS = {};

// Frontmatter here is a flat map of top-level keys, some with indented blocks.
// Rather than take a YAML dependency for two edits, walk it line by line: a
// top-level key starts at column 0, and everything indented under it belongs to
// that key. Returns the rebuilt document.
const rewriteFrontmatter = (source, { drop = [], replace = {} }) => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (match === null) return null;

  const lines = match[1].split("\n");
  const blocks = [];
  for (const line of lines) {
    const key = /^([A-Za-z_-]+):/.exec(line);
    if (key === null && blocks.length > 0) {
      blocks[blocks.length - 1].lines.push(line);
    } else if (key !== null) {
      blocks.push({ key: key[1], lines: [line] });
    }
  }

  const kept = [];
  for (const block of blocks) {
    if (drop.includes(block.key)) continue;
    if (Object.hasOwn(replace, block.key)) {
      kept.push(`${block.key}: ${JSON.stringify(replace[block.key])}`);
      continue;
    }
    kept.push(...block.lines);
  }

  return `---\n${kept.join("\n")}\n---\n${source.slice(match[0].length)}`;
};

// The value as the validator counts it, with YAML quoting removed.
const frontmatterDescription = (source) => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (match === null) return null;
  const found = /^description:\s*([\s\S]*?)(?=\n[A-Za-z_-]+:|$)/m.exec(match[1]);
  if (found === null) return null;
  const raw = found[1].trim();
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(1, -1);
    }
  }
  return raw;
};

// PNG dimensions straight from the IHDR chunk: 8-byte signature, then a length
// and type, then width and height as big-endian uint32s at offsets 16 and 20.
// The pack shells out to `sips` for this, which is macOS-only and would make
// this build a maintainer-laptop step; the header is fixed by the spec and
// needs no dependency.
const pngSize = (buffer) => {
  const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || buffer.subarray(0, 8).equals(SIGNATURE) === false) {
    return null;
  }
  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

const outFlag = process.argv.indexOf("--out");
const outDir = resolve(
  repoRoot,
  outFlag === -1 ? "dist" : process.argv[outFlag + 1],
);

const stageDir = join(outDir, ".codex-package");
const zipPath = join(outDir, "gtm-skills-codex.zip");

const die = (message) => {
  console.error(`error: ${message}`);
  process.exit(1);
};

// The repo's Claude manifest is the single source of truth for the bundle
// version, so the uploaded package can never claim a version the repo doesn't.
const pluginJson = JSON.parse(
  readFileSync(join(repoRoot, ".claude-plugin/plugin.json"), "utf8"),
);
const { version } = pluginJson;
if (typeof version !== "string" || /^\d+\.\d+\.\d+$/.test(version) === false) {
  die(`.claude-plugin/plugin.json has no usable semver version (got ${version})`);
}

// A skill is any top-level directory holding a SKILL.md. This matches
// scripts/validate.ts and keeps every installable skill visible at the root.
const skillDirs = readdirSync(repoRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => existsSync(join(repoRoot, name, "SKILL.md")))
  .sort();

if (skillDirs.length === 0) {
  die("found no skill directories at the repo root");
}

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(join(stageDir, ".codex-plugin"), { recursive: true });
mkdirSync(join(stageDir, "skills"), { recursive: true });

const descriptionErrors = [];

for (const name of skillDirs) {
  cpSync(join(repoRoot, name), join(stageDir, "skills", name), {
    recursive: true,
    dereference: true,
  });

  const skillMdPath = join(stageDir, "skills", name, "SKILL.md");
  const source = readFileSync(skillMdPath, "utf8");
  const replace = {};

  const override = SHORT_DESCRIPTIONS[name];
  const current = frontmatterDescription(source);
  if (current === null) {
    die(`${name}/SKILL.md has no readable description in its frontmatter`);
  }

  if (override !== undefined) {
    if (override.length > SKILL_DESCRIPTION_LIMIT) {
      descriptionErrors.push(
        `SHORT_DESCRIPTIONS["${name}"] is ${override.length} chars, over the ${SKILL_DESCRIPTION_LIMIT} limit`,
      );
    }
    replace.description = override;
  } else if (current.length > SKILL_DESCRIPTION_LIMIT) {
    descriptionErrors.push(
      `${name}: description is ${current.length} chars, over OpenAI's ${SKILL_DESCRIPTION_LIMIT} limit. ` +
        `Add a rewrite to SHORT_DESCRIPTIONS in this script — do not shorten the repo copy, other channels use it.`,
    );
  }

  // OpenAI rejects any `metadata` in SKILL.md; ours is OpenClaw install config.
  const rewritten = rewriteFrontmatter(source, {
    drop: ["metadata"],
    replace,
  });
  if (rewritten === null) {
    die(`${name}/SKILL.md has no frontmatter block`);
  }
  writeFileSync(skillMdPath, rewritten, "utf8");
}

if (descriptionErrors.length > 0) {
  for (const e of descriptionErrors) console.error(`error: ${e}`);
  process.exit(1);
}

for (const file of ["README.md", "LICENSE"]) {
  if (existsSync(join(repoRoot, file))) {
    cpSync(join(repoRoot, file), join(stageDir, file));
  }
}

// interface.composerIcon and interface.logo are required and must both point at
// a square image. assets/icon.png is the Cargo product mark at 512x512.
const iconSource = join(repoRoot, "assets/icon.png");
if (existsSync(iconSource) === false) {
  die("assets/icon.png is missing — the manifest requires a square icon");
}
mkdirSync(join(stageDir, "assets"), { recursive: true });
cpSync(iconSource, join(stageDir, "assets/icon.png"));

// `name` is kebab-case and stable — it is the directory identity and CANNOT be
// changed after first publish. `gtm-skills` alone says nothing about who ships
// it in a catalog shared with ChatGPT, and `cargo` alone collides with Rust's
// package manager, so this sits alongside the pack's `cargo-skills`.
const manifest = {
  name: "cargo-gtm-skills",
  version,
  description:
    "Routed go-to-market skills over the Cargo CLI, each focused on one job, including reusable CDK cookbooks such as account enrichment. Install one skill or the full bundle to research accounts, build markets, enrich professional company and contact data, verify business emails, score accounts, and monitor buying signals. Business-to-business professional identities only. Skills preview spend before paid calls. They send no messages. Bulk unsolicited messaging, purchased or scraped lists, and consumer targeting are out of scope.",
  author: { name: "getcargo" },
  homepage: "https://getcargo.ai",
  repository: "https://github.com/getcargohq/gtm-skills",
  license: "MIT",
  keywords: [
    "gtm",
    "go-to-market",
    "sales",
    "prospecting",
    "lead-enrichment",
    "b2b-data",
    "crm",
    "revops",
    "data-enrichment",
    "buying-signals",
  ],
  skills: "./skills/",
  interface: {
    displayName: "Cargo GTM Skills",
    // 30 chars in the directory, not the 240 the uploader accepts.
    shortDescription: "GTM skills and CDK cookbooks",
    composerIcon: "./assets/icon.png",
    logo: "./assets/icon.png",
    capabilities: ["Read", "Write"],
  },
};

const manifestErrors = [];
const check = (ok, message) => {
  if (ok === false) manifestErrors.push(message);
};

check(
  /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(manifest.name) &&
    manifest.name.length <= LIMITS.pluginName,
  `name "${manifest.name}" must be ASCII alphanumeric/_/- , start alphanumeric, and be <= ${LIMITS.pluginName} chars`,
);
check(
  /^\d+\.\d+\.\d+$/.test(manifest.version),
  `version "${manifest.version}" must be semver`,
);
check(
  manifest.description.length > 0 &&
    manifest.description.length <= LIMITS.pluginDescription,
  `description is ${manifest.description.length} chars, limit ${LIMITS.pluginDescription}`,
);
check(
  manifest.author.name.length <= LIMITS.authorName,
  `author.name is ${manifest.author.name.length} chars, limit ${LIMITS.authorName}`,
);
for (const [field, limit] of [
  ["displayName", LIMITS.displayName],
  ["shortDescription", LIMITS.shortDescription],
]) {
  const value = manifest.interface[field];
  check(
    typeof value === "string" && value.length > 0 && value.length <= limit,
    `interface.${field} is ${value?.length ?? 0} chars, directory limit ${limit}`,
  );
  check(
    /[\n\r]/.test(value ?? "") === false,
    `interface.${field} must be a single line`,
  );
}
for (const url of [manifest.homepage, manifest.repository]) {
  check(url.startsWith("https://"), `${url} must be HTTPS`);
}
for (const name of skillDirs) {
  const identity = `${manifest.name}:${name}`;
  check(
    identity.length <= LIMITS.skillIdentity,
    `skill identity "${identity}" is ${identity.length} chars, limit ${LIMITS.skillIdentity}`,
  );
}

if (manifestErrors.length > 0) {
  for (const e of manifestErrors) console.error(`error: ${e}`);
  process.exit(1);
}

writeFileSync(
  join(stageDir, ".codex-plugin/plugin.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

rmSync(zipPath, { force: true });
execFileSync(
  "zip",
  ["-qr", zipPath, ".", "-x", "*.DS_Store", "__MACOSX*"],
  { cwd: stageDir },
);

// Verify the archive rather than the staging directory: what ships is what the
// zip contains, and a symlink or a missing SKILL.md only shows up post-zip.
const entries = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const problems = [];
if (entries.includes(".codex-plugin/plugin.json") === false) {
  problems.push("manifest is not at the archive root");
}
const packagedSkills = entries.filter((e) =>
  /^skills\/[^/]+\/SKILL\.md$/.test(e),
).length;
if (packagedSkills !== skillDirs.length) {
  problems.push(
    `archive has ${packagedSkills} SKILL.md files, repo has ${skillDirs.length}`,
  );
}
if (
  !entries.includes("skills/account-enrichment/SKILL.md") ||
  !entries.includes(
    "skills/account-enrichment/infra/account-enrichment.ts",
  )
) {
  problems.push(
    "archive is missing account-enrichment or its infrastructure template",
  );
}

// Skills-only, asserted rather than assumed. The hooks are wired with
// ${CLAUDE_PLUGIN_ROOT}, which nothing outside Claude Code is known to set, so
// shipping them here would put an unverified path in front of a human reviewer
// for no benefit — and a copy of the approval allowlist somewhere it cannot run
// is worse than no copy.
for (const entry of entries) {
  if (/^(skills\/[^/]+\/)?hooks\//.test(entry)) {
    problems.push(`${entry} is a hook; this package is skills-only`);
  }
}

// No zip listing prints symlink targets — `unzip -l` gives length, date, and
// name, and the zipinfo formats do not print ` -> target` either. The file type
// survives only in zipinfo's Unix mode column, where a symlink reads
// `lrwxrwxrwx`. Every entry must yield a mode for this to mean anything, so an
// unparseable listing is itself a failure rather than a silent pass.
const modes = execFileSync("unzip", ["-Z", zipPath], { encoding: "utf8" })
  .split("\n")
  .map((line) => /^([-bcdlps])[-rwxsStT]{9}\s+\d+\.\d+\s+\S+\s/.exec(line))
  .filter((match) => match !== null);

if (modes.length !== entries.length) {
  problems.push(
    `zipinfo reported modes for ${modes.length} of ${entries.length} entries, so the archive cannot be shown symlink-free`,
  );
}
const symlinked = modes
  .filter((match) => match[1] === "l")
  .map((match) => /\d\d:\d\d\s+(.*)$/.exec(match.input)?.[1] ?? match.input);
if (symlinked.length > 0) {
  problems.push(
    `archive contains symlinks; they must be dereferenced: ${symlinked.join(", ")}`,
  );
}

// Every interface asset path must resolve inside the archive, and the images
// must be square — the validator rejects both a dangling path and a non-square
// image, and neither is visible from the manifest alone.
for (const field of ["composerIcon", "logo"]) {
  const ref = manifest.interface[field];
  const entry = ref.replace(/^\.\//, "");
  if (entries.includes(entry) === false) {
    problems.push(`interface.${field} points at ${ref}, absent from the archive`);
    continue;
  }
  const bytes = execFileSync("unzip", ["-p", zipPath, entry], {
    maxBuffer: 32 * 1024 * 1024,
    encoding: "buffer",
  });
  const size = pngSize(bytes);
  if (size === null) {
    problems.push(`interface.${field} (${ref}) is not a readable PNG`);
    continue;
  }
  if (size.width !== size.height) {
    problems.push(
      `interface.${field} (${ref}) is ${size.width}x${size.height}, must be square`,
    );
  }
  if (size.width < LIMITS.iconMinPx || size.width > LIMITS.iconMaxPx) {
    problems.push(
      `interface.${field} (${ref}) is ${size.width}px, must be ${LIMITS.iconMinPx}-${LIMITS.iconMaxPx}px`,
    );
  }
  if (bytes.length > LIMITS.iconBytes) {
    problems.push(
      `interface.${field} (${ref}) is ${bytes.length} bytes, limit ${LIMITS.iconBytes}`,
    );
  }
}

// Archive shape. The uploader rejects the whole file for any of these, with no
// indication of which entry was at fault.
if (entries.length > LIMITS.archiveEntries) {
  problems.push(`archive has ${entries.length} entries, limit ${LIMITS.archiveEntries}`);
}
const archiveBytes = statSync(zipPath).size;
if (archiveBytes > LIMITS.archiveBytes) {
  problems.push(`archive is ${archiveBytes} bytes, limit ${LIMITS.archiveBytes}`);
}
for (const entry of entries) {
  if (entry.includes("\\")) {
    problems.push(`${entry} uses backslashes; paths must use /`);
  }
  if (entry.split("/").some((s) => s === ".." || s.trim() !== s)) {
    problems.push(`${entry} has a '..' or whitespace-padded segment`);
  }
  if (entry.split("/").filter(Boolean).length > LIMITS.pathSegments) {
    problems.push(`${entry} exceeds ${LIMITS.pathSegments} path segments`);
  }
}
// "Skill files directly under skills/ are ignored" — a skill must be a
// subdirectory, so a stray file there silently drops a skill from the listing.
for (const entry of entries) {
  if (/^skills\/[^/]+$/.test(entry) && entry.endsWith("/") === false) {
    problems.push(`${entry} sits directly under skills/ and would be ignored`);
  }
}

// Re-read every packaged SKILL.md out of the archive and apply the validator's
// own rules. Checking the staging copy would miss anything the zip step changed,
// and a rejected upload costs a review cycle.
for (const entry of entries.filter((e) =>
  /^skills\/[^/]+\/SKILL\.md$/.test(e),
)) {
  const body = execFileSync("unzip", ["-p", zipPath, entry], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (/^metadata:/m.test(body)) {
    problems.push(`${entry} still carries a metadata block`);
  }
  const description = frontmatterDescription(body);
  if (description === null) {
    problems.push(`${entry} lost its description`);
  } else if (description.length > SKILL_DESCRIPTION_LIMIT) {
    problems.push(
      `${entry} description is ${description.length} chars, over ${SKILL_DESCRIPTION_LIMIT}`,
    );
  }
}

rmSync(stageDir, { recursive: true, force: true });

if (problems.length > 0) {
  for (const p of problems) console.error(`error: ${p}`);
  process.exit(1);
}

console.log(`cargo-gtm-skills ${version} — ${skillDirs.length} skills`);
console.log(zipPath);
