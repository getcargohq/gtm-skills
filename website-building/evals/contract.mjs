import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resetRegistry, resources } from "@cargo-ai/cdk";

// The boundaries CDK schema validation cannot express, checked against the
// compiled registry. `cargo-cdk check` proves the resources are well formed;
// this proves they are still the website this skill describes after an agent
// has adapted them.
//
// Run it from the skill folder after every adaptation:
//   node --import tsx evals/contract.mjs
//
// Every resource file is loaded, so the contract still runs once
// `domains/website.ts` is deleted for DNS hosted elsewhere. A directory with a
// package.json is the app's browser code, which the CDK loader skips too.
const resourceFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return existsSync(join(path, "package.json")) ? [] : resourceFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });

resetRegistry();
const stamp = Date.now();
for (const file of resourceFiles(fileURLToPath(new URL("../infra", import.meta.url))))
  await import(`${pathToFileURL(file).href}?contract=${stamp}`);

const all = resources();
const ofKind = (kind) => all.filter((resource) => resource.kind === kind);

const folder = all.find((resource) => resource.id === "folder:website-building-apps");
assert.ok(folder, "defineFolder(website-building-apps) must exist");
assert.equal(folder.spec.folderKind, "app", "the folder must be an app folder");

const apps = ofKind("app");
assert.equal(apps.length, 1, "exactly one defineApp: the website");
const [app] = apps;
assert.equal(
  app.spec.folderUuid?.resourceId,
  folder.id,
  "the app must be filed in the website-building-apps folder",
);

// The app declares its hostname, never the apex.
const [host] = app.spec.domains ?? [];
assert.match(
  host ?? "",
  /^www\./,
  "the app must declare its www hostname: the apex cannot CNAME to an app",
);

// The app is its own package, and its build leaves a static export in dist/.
const appDir = join(process.cwd(), app.spec.path);
for (const file of ["package.json", "package-lock.json"])
  assert.ok(existsSync(join(appDir, file)), `the app package needs ${file}`);
const { scripts } = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"));
assert.match(
  scripts?.build ?? "",
  /next build.*dist/,
  "the build script must run next build and leave the export in dist/, where Cargo reads it",
);
const nextConfig = readFileSync(join(appDir, "next.config.ts"), "utf8");
assert.match(nextConfig, /output:\s*"export"/, 'next.config.ts must keep output: "export"');
assert.match(
  nextConfig,
  /trailingSlash:\s*true/,
  "next.config.ts must keep trailingSlash: true, so links, canonicals and the sitemap share one URL form",
);

// A Cargo-held domain publishes what the app needs and forwards the apex.
// No domain is valid: the DNS lives at another provider.
const domains = ofKind("domain");
assert.ok(domains.length <= 1, "at most one defineDomain");
for (const domain of domains) {
  assert.equal(
    domain.spec.adopt,
    true,
    "adopt the domain the workspace owns: registering one is a non-refundable purchase, approved on the plan line",
  );
  assert.ok(
    host.endsWith(`.${domain.spec.name}`),
    `${host} must sit in ${domain.spec.name}`,
  );
  assert.ok(
    (domain.spec.dnsRecords ?? []).some(
      (record) => record?.resourceId === app.id && record.field === "domainRecords",
    ),
    "dnsRecords must include the app's domainRecords, or the zone gets no _cargo-verify TXT or www CNAME",
  );
  assert.equal(
    domain.spec.redirectUrl,
    `https://${host}`,
    "the apex must forward to the www host",
  );
}

console.log("ok: website-building contract");
