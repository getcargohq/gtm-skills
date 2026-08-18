#!/usr/bin/env node
// Builds catalog.json: every skill in this repo as one JSON record, so a site
// or another skills repo can render the menu without parsing markdown. This is
// the ONE place markdown is turned into data, next to the validators that
// guarantee the shape (validate.ts for run-once skills, check-cdk-examples.mjs
// for the ones that carry a CDK example). Consumers fetch
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
const RESOURCE_DIRS = new Set([
  "models",
  "plays",
  "agents",
  "segments",
  "connectors",
  "tools",
  "apps",
  "mcp",
  "context",
  "files",
  "territories",
  "capacities",
  "folders",
  "workers",
]);

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
const bullets = (text) =>
  (text ?? "")
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());

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
  const isCdk = fm.metadata?.source === "cdk-example";
  const rec = {
    name,
    kind: isCdk ? "cdk-example" : "run-once",
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
  if (isCdk) {
    const a = approvals[name] ?? {};
    Object.assign(rec, {
      state: a.state ?? "to-be-approved",
      chain: a.chain ?? null,
      resources: readdirSync(dir).filter(
        (f) => RESOURCE_DIRS.has(f) && statSync(join(dir, f)).isDirectory(),
      ),
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
// Resource folders that are not skills yet: listed so nobody is told they do not exist.
const pending = readdirSync(root)
  .filter(
    (n) =>
      !n.startsWith(".") &&
      statSync(join(root, n)).isDirectory() &&
      !existsSync(join(root, n, "SKILL.md")) &&
      existsSync(join(root, n, "README.md")) &&
      readdirSync(join(root, n)).some((f) => RESOURCE_DIRS.has(f)),
  )
  .sort()
  .map((name) => {
    const readme = readFileSync(join(root, name, "README.md"), "utf8");
    const para =
      readme.split("\n\n").find((p) => p && !p.startsWith("#")) ?? "";
    return {
      name,
      kind: "cdk-example",
      skill: false,
      job: para.replace(/\s+/g, " ").trim(),
      state: approvals[name]?.state ?? "to-be-approved",
    };
  });

const catalog = { source: "getcargohq/gtm-skills", skills, pending };
const rendered = JSON.stringify(catalog, null, 2) + "\n";
if (process.argv.includes("--check")) {
  const current = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (current !== rendered) {
    console.error(
      "catalog.json is stale. Regenerate with: node scripts/build-catalog.mjs",
    );
    process.exit(1);
  }
  console.log(
    `ok: catalog.json matches (${skills.length} skills, ${pending.length} pending)`,
  );
} else {
  writeFileSync(out, rendered);
  console.log(
    `wrote catalog.json (${skills.length} skills, ${pending.length} pending)`,
  );
}
