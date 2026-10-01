import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resetRegistry, resources } from "@cargo-ai/cdk";

// The boundaries CDK schema validation cannot express, checked against the
// compiled registry. `cargo-cdk check` proves the resources are well formed;
// this proves they are still the website this skill describes after an agent
// has adapted them.
//
// Run it from the skill folder after every adaptation:
//   node --import tsx evals/contract.mjs
const skill = fileURLToPath(new URL("../", import.meta.url));
const infra = join(skill, "infra");

// Every resource file, so the contract still runs once `domains/website.ts`
// is deleted for a domain whose DNS lives elsewhere. The Next.js package is
// browser code, not resources: the CDK loader skips it too.
const resourceFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return existsSync(join(path, "package.json")) ? [] : resourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")
      ? [path]
      : [];
  });

resetRegistry();
const stamp = Date.now();
for (const file of resourceFiles(infra))
  await import(`${pathToFileURL(file).href}?contract=${stamp}`);

const all = resources();
const byId = new Map(all.map((resource) => [resource.id, resource]));
const ofKind = (kind) => all.filter((resource) => resource.kind === kind);

// One app, filed in this skill's app folder, and nothing else that runs.
const folder = byId.get("folder:website-building-apps");
assert.ok(folder, "defineFolder(website-building-apps) must exist");
assert.equal(folder.spec.folderKind, "app", "the folder must be an app folder");
for (const kind of ["agent", "connector", "model", "play", "tool", "worker"]) {
  assert.equal(
    ofKind(kind).length,
    0,
    `no ${kind} belongs in this skill: the local coding agent does the website work through pull requests`,
  );
}
const apps = ofKind("app");
assert.equal(apps.length, 1, "exactly one defineApp: the website");
const [app] = apps;
assert.equal(
  app.spec.folderUuid?.resourceId,
  "folder:website-building-apps",
  "the app must be filed in the website-building-apps folder",
);

// The app is the static Next.js export Cargo routes statically.
const appDir = join(process.cwd(), app.spec.path);
for (const file of ["package.json", "package-lock.json", "next.config.ts"]) {
  assert.ok(
    existsSync(join(appDir, file)),
    `the app package needs ${file} at ${app.spec.path}`,
  );
}
const nextConfig = readFileSync(join(appDir, "next.config.ts"), "utf8");
assert.match(
  nextConfig,
  /output:\s*"export"/,
  'next.config.ts must keep output: "export": Cargo Hosting serves static files only',
);
assert.match(
  nextConfig,
  /trailingSlash:\s*true/,
  "next.config.ts must keep trailingSlash: true, or /about serves the home page",
);
const build = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"))
  .scripts?.build;
assert.match(
  build ?? "",
  /next build.*dist/,
  "the build script must run next build and leave the export in dist/, where Cargo reads it",
);
for (const generated of ["out", "next-env.d.ts"]) {
  assert.equal(
    existsSync(join(appDir, generated)),
    false,
    `${generated} is generated: Cargo would upload it with the source and the app hash would change. Delete it.`,
  );
}

// The app declares its hostname, never the apex.
const domains = app.spec.domains ?? [];
assert.ok(
  domains.length > 0,
  "the app must declare the www hostname it is served on",
);
const host = domains[0];
assert.match(
  host,
  /^www\./,
  "serve the site on www.<domain>: the apex cannot CNAME to an app",
);
const site = JSON.parse(readFileSync(join(appDir, "site.json"), "utf8"));
assert.ok(
  site.canonicalUrl === "" || site.canonicalUrl === `https://${host}/`,
  `site.json canonicalUrl must be "" (draft) or https://${host}/`,
);
assert.ok(
  site.status === "draft" || site.canonicalUrl === `https://${host}/`,
  "a ready site must carry its canonical URL",
);

// A Cargo-held domain publishes exactly what the app needs and forwards the
// apex. Absent is valid: the DNS lives at another provider.
const domainResources = ofKind("domain");
assert.ok(domainResources.length <= 1, "at most one defineDomain");
if (domainResources.length === 1) {
  const [domain] = domainResources;
  assert.equal(
    domain.spec.adopt,
    true,
    "adopt the domain the workspace owns; registering one is a non-refundable purchase the operator approves on the plan line, recorded under ## Decisions",
  );
  assert.ok(
    domains.every((hostname) => hostname.endsWith(`.${domain.spec.name}`)),
    `every app hostname must sit in ${domain.spec.name}`,
  );
  assert.ok(
    (domain.spec.dnsRecords ?? []).some(
      (record) =>
        record?.__token === true &&
        record.resourceId === app.id &&
        record.field === "domainRecords",
    ),
    "dnsRecords must include the app's domainRecords: the zone is replaced by this list",
  );
  assert.equal(
    domain.spec.redirectUrl,
    `https://${host}`,
    "the apex must forward to the www host",
  );
}

// The removed machinery stays removed.
for (const leftover of [
  "infra/website.json",
  "infra/settings.ts",
  "infra/resources.ts",
  "infra/agents",
  "scripts",
  "references/terminal",
]) {
  assert.equal(
    existsSync(join(skill, leftover)),
    false,
    `${leftover} belongs to the old generator layout: one file per resource now`,
  );
}
const SKIP = new Set(["node_modules", "dist", ".next", "out"]);
const textFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return textFiles(path);
    return /\.(md|ts|tsx|mjs|json|css)$/.test(entry.name) &&
      entry.name !== "package-lock.json"
      ? [path]
      : [];
  });
const self = fileURLToPath(import.meta.url);
for (const file of textFiles(skill)) {
  if (file === self) continue;
  const text = readFileSync(file, "utf8");
  for (const word of [
    /snitcher/i,
    /visitor/i,
    /maintainer/i,
    /terminal-bootstrap/i,
    /website\.mjs/i,
  ]) {
    assert.equal(
      word.test(text),
      false,
      `${relative(skill, file)} mentions ${word.source}, which this skill no longer ships`,
    );
  }
}

console.log("ok: website-building contract");
