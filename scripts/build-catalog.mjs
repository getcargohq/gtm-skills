#!/usr/bin/env node
// Builds catalog.json: every skill in this repo as one JSON record, so a site
// or another skills repo can render the menu without parsing markdown. This is
// the ONE place markdown is turned into data, next to the validators that
// guarantee the shape (validate.ts for one-off skills, check-pipelines.mjs
// for the pipeline skills). Consumers fetch
//   https://raw.githubusercontent.com/getcargohq/gtm-skills/main/catalog.json
// and never clone.
//
//   node scripts/build-catalog.mjs           # write catalog.json
//   node scripts/build-catalog.mjs --check   # CI: fail if stale
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
// and a cookbook is free to put everything in one `infra/index.ts` anyway.
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
  const job = description.split(/\.\s+Triggers:/)[0] + ".";
  const isCookbook = fm.metadata?.source === "cookbook";
  const rec = {
    name,
    kind: isCookbook ? "cookbook" : "one-off",
    job,
    description,
    version: fm.version ?? null,
    homepage: fm.homepage ?? null,
    group: groupOf(name),
    install: `npx skills add getcargohq/gtm-skills/${name}`,
    partOf: bullets(section(body, "Part of"))
      .map((b) => b.replace(/`/g, "").split(/[:\s]/)[0])
      .filter(Boolean),
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
    });
  }
  skills.push(rec);
}

const catalog = { source: "getcargohq/gtm-skills", skills };
const rendered = JSON.stringify(catalog, null, 2) + "\n";
if (process.argv.includes("--check")) {
  const current = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (current !== rendered) {
    console.error(
      "catalog.json is stale. Regenerate with: node scripts/build-catalog.mjs",
    );
    process.exit(1);
  }
  console.log(`ok: catalog.json matches (${skills.length} skills)`);
} else {
  writeFileSync(out, rendered);
  console.log(`wrote catalog.json (${skills.length} skills)`);
}
