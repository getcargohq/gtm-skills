#!/usr/bin/env node
// Builds catalog.json: every skill in this repo as one JSON record, so a site
// or another skills repo can render the menu without parsing markdown. This is
// the ONE place markdown is turned into data, next to the validators that
// guarantee the shape (validate.ts for one-off skills, check-pipelines.mjs
// for the pipeline skills). Consumers fetch
//   https://raw.githubusercontent.com/getcargohq/gtm-skills/main/catalog.json
// and never clone.
//
// It also writes the README's skill tables, between the catalog markers.
//
//   node scripts/build-catalog.mjs           # write catalog.json + README tables
//   node scripts/build-catalog.mjs --check   # CI: fail if either is stale
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "catalog.json");
const approvals = JSON.parse(
  readFileSync(join(root, ".github/data/approvals.json"), "utf8"),
);
const groupings = JSON.parse(
  readFileSync(join(root, "skills.sh.json"), "utf8"),
).groupings;
const groupOf = (name) =>
  groupings.find((g) => g.skills.includes(name))?.title ?? null;
// What a cookbook declares, read from the `define*` calls themselves rather
// than from its directory names. Every cookbook keeps its resources in `infra/`
// now, so counting top-level folders would answer "infra" for all of them —
// and a cookbook is free to lay `infra/` out however it likes.
const RESOURCE_BY_BUILDER = {
  defineAgent: "agents",
  defineAlert: "alerts",
  defineApp: "apps",
  defineCapacity: "capacities",
  defineConnector: "connectors",
  defineContext: "context",
  defineDomain: "domains",
  defineFile: "files",
  defineFolder: "folders",
  defineMailbox: "mailboxes",
  defineMcpServer: "mcp",
  defineModel: "models",
  definePlay: "plays",
  defineRelationship: "relationships",
  defineSegment: "segments",
  defineTerritory: "territories",
  defineTool: "tools",
  defineWorker: "workers",
};

const tsFilesUnder = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return tsFilesUnder(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });

const resourcesOf = (dir) => {
  const declared = new Set();
  for (const file of tsFilesUnder(dir)) {
    const source = readFileSync(file, "utf8");
    for (const [builder, resource] of Object.entries(RESOURCE_BY_BUILDER)) {
      if (new RegExp(`\\b${builder}\\s*\\(`).test(source)) {
        declared.add(resource);
      }
    }
  }
  return [...declared].sort();
};

// What a cookbook connects to, read from its `defineConnector` calls. `cargo`
// is left out: it is the platform the cookbook runs on, not something a
// reader has to go and authenticate.
const integrationsOf = (dir) => {
  const found = new Set();
  for (const file of tsFilesUnder(dir)) {
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(/^\s*integration:\s*"([^"]+)"/gm)) {
      if (m[1] !== "cargo") found.add(m[1]);
    }
  }
  return [...found].sort();
};

// What a one-off calls, read from its commands rather than from the
// `Providers:` clause, which is routing prose. These pairs are the ones
// validate.ts checks against the playbooks. `cargo` is left out here too.
const calledOf = (body) => [
  ...new Set(
    [...body.matchAll(/"integrationSlug":"([A-Za-z0-9]+)"/g)]
      .map((m) => m[1])
      .filter((slug) => slug !== "cargo"),
  ),
];

// `## Example`: one `> ` line the user says, then, after the literal
// `Illustrative output` label, the markdown it produces. validate.ts holds
// every skill to that shape, so a skill without one reads as `null` here only
// while it is being written.
const EXAMPLE_LABEL = /^Illustrative output, fictional records:\s*$/m;
const exampleOf = (text) => {
  if (text === null) return null;
  const label = EXAMPLE_LABEL.exec(text);
  if (!label) return null;
  // Above the label only: an output quoting an email thread uses `> ` too.
  const prompt = text
    .slice(0, label.index)
    .split("\n")
    .filter((l) => l.startsWith("> "))
    .map((l) => l.slice(2).trim())
    .join(" ");
  if (!prompt) return null;
  return {
    prompt,
    output: text.slice(label.index + label[0].length).trim(),
  };
};

const section = (body, heading) => {
  const m = body.match(
    new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`),
  );
  return m ? m[1].trim() : null;
};
const tableRows = (text) =>
  (text ?? "")
    .split("\n")
    .filter((l) => l.startsWith("| `"))
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim().replace(/^`|`$/g, "")),
    );
const bullets = (text) => {
  const items = [];
  for (const line of (text ?? "").split("\n")) {
    if (line.startsWith("- ")) items.push(line.slice(2).trim());
    else if (/^\s{2,}\S/.test(line) && items.length > 0)
      items[items.length - 1] += ` ${line.trim()}`;
  }
  return items;
};

const skills = [];
for (const name of readdirSync(root).sort()) {
  const dir = join(root, name);
  if (
    name.startsWith(".") ||
    !statSync(dir).isDirectory() ||
    !existsSync(join(dir, "SKILL.md"))
  )
    continue;
  const text = readFileSync(join(dir, "SKILL.md"), "utf8");
  const end = text.indexOf("\n---", 3);
  const fm = parseYaml(text.slice(4, end));
  const body = text.slice(end + 4);
  const description = fm.description ?? "";
  // The job is display copy. "powered by Cargo" is there for routing (the
  // agent reading the description), and in a table of Cargo skills it is noise.
  const job =
    description
      .split(/\.\s+Triggers:/)[0]
      .replace(/,? powered by Cargo(?=[\s.,—]|$)/, "")
      .trim() + ".";
  const isCookbook = fm.metadata?.source === "cookbook";
  const rec = {
    name,
    kind: isCookbook ? "cookbook" : "one-off",
    job,
    description,
    version: fm.version ?? null,
    homepage: fm.homepage ?? null,
    group: groupOf(name),
    // A one-off skill is a procedure, so `skills add` installs it. A cookbook is
    // a procedure *plus* infrastructure: its `infra/` has to land in the CDK
    // project while the rest goes to the repo's skills layer, and only the CDK
    // knows how to split it. `skills add` would install the whole folder as one
    // skill, putting TypeScript resources where the loader never looks.
    install: isCookbook
      ? `cargo-ai cdk add cookbook/${name}`
      : `npx skills add getcargohq/gtm-skills/${name}`,
    partOf: bullets(section(body, "Part of"))
      .map((b) => b.replace(/`/g, "").split(/[:\s]/)[0])
      .filter(Boolean),
    personas: fm.metadata?.personas ?? [],
    integrations: isCookbook
      ? integrationsOf(join(dir, "infra"))
      : calledOf(body),
    example: exampleOf(section(body, "Example")),
  };
  if (isCookbook) {
    const a = approvals[name] ?? {};
    Object.assign(rec, {
      state: a.state ?? "to-be-approved",
      chain: a.chain ?? null,
      resources: resourcesOf(dir),
      asked: tableRows(section(body, "What you will be asked")).map(
        ([input, kind, how, why]) => ({ input, kind, how, why }),
      ),
      canChange: tableRows(section(body, "What you can change")).map(
        ([id, when, how, cost]) => ({ id, when, how, cost }),
      ),
      shouldNotChange: bullets(section(body, "What should not change")),
      doneWhen: bullets(section(body, "Done when")),
      cost: section(body, "What it costs"),
      composesInto: section(body, "Composes into"),
      worksBestAfter: [],
      nextSteps: fm.metadata?.nextSteps ?? [],
    });
  } else {
    Object.assign(rec, {
      cost: section(body, "What it costs"),
      worthKnowing: bullets(section(body, "Worth knowing")),
    });
  }
  skills.push(rec);
}

// A pipeline only writes what it sets up (`nextSteps`). What works best before
// it is the same relation read backwards, so it is derived here and the two
// views on the site always agree.
for (const s of skills)
  for (const next of s.nextSteps ?? [])
    skills.find((t) => t.name === next)?.worksBestAfter?.push(s.name);

const catalog = { source: "getcargohq/gtm-skills", skills };
const rendered = JSON.stringify(catalog, null, 2) + "\n";

// The README's skill tables are the catalog again, for a person: by job, then
// by role. Generated between markers so a job line, a persona or an example
// prompt is written once, in SKILL.md, and a new skill cannot be missing from
// the page everybody lands on.
const PERSONA_LABELS = {
  "sales-development": "Sales development",
  "account-executive": "Account executives",
  revops: "RevOps",
  "sales-leadership": "Sales leadership",
  marketing: "Marketing",
  "gtm-engineering": "GTM engineering",
};
const cell = (text) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");
const link = (s) => `[\`${s.name}\`](${s.name}/SKILL.md)`;
const readmeTables = () => {
  const lines = [];
  for (const g of groupings) {
    const members = g.skills
      .map((n) => skills.find((s) => s.name === n))
      .filter(Boolean);
    if (members.length === 0) continue;
    lines.push(`### ${g.title}`, "", g.description, "");
    lines.push("| Skill | Does | Try saying |", "| --- | --- | --- |");
    for (const s of members) {
      const say = s.example ? `“${cell(s.example.prompt)}”` : "";
      lines.push(`| ${link(s)} | ${cell(s.job)} | ${say} |`);
    }
    lines.push("");
  }
  lines.push("### By role", "");
  for (const [persona, label] of Object.entries(PERSONA_LABELS)) {
    // Split on the primary persona, so each role reads "yours" before "also
    // useful" instead of one undifferentiated list.
    const members = skills.filter((s) => s.personas.includes(persona));
    const primary = members.filter((s) => s.personas[0] === persona);
    const also = members.filter((s) => s.personas[0] !== persona);
    if (members.length === 0) continue;
    const parts = [];
    if (primary.length > 0) parts.push(primary.map(link).join(", "));
    if (also.length > 0) parts.push(`also ${also.map(link).join(", ")}`);
    lines.push(`- **${label}:** ${parts.join("; ")}`);
  }
  return lines.join("\n");
};
const START = "<!-- catalog:start — generated by scripts/build-catalog.mjs -->";
const END = "<!-- catalog:end -->";
const readmePath = join(root, "README.md");
const readme = readFileSync(readmePath, "utf8");
const from = readme.indexOf(START);
const to = readme.indexOf(END);
if (from === -1 || to === -1) {
  console.error(`README.md needs the ${START} … ${END} markers`);
  process.exit(1);
}
const renderedReadme =
  readme.slice(0, from + START.length) +
  "\n\n" +
  readmeTables() +
  "\n\n" +
  readme.slice(to);

if (process.argv.includes("--check")) {
  const current = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (current !== rendered || readme !== renderedReadme) {
    console.error(
      "catalog.json or the README tables are stale. Regenerate with: node scripts/build-catalog.mjs",
    );
    process.exit(1);
  }
  console.log(
    `ok: catalog.json and README tables match (${skills.length} skills)`,
  );
} else {
  writeFileSync(out, rendered);
  writeFileSync(readmePath, renderedReadme);
  console.log(`wrote catalog.json and README tables (${skills.length} skills)`);
}
