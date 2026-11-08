import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resetRegistry, resources } from "@cargo-ai/cdk";

// The boundaries schema validation cannot express, checked against the
// compiled registry. `cargo-ai project check` proves the resources are well
// formed; this proves they are still the board this skill describes after an
// agent has adapted them.
//
// Run it from the skill folder after every adaptation:
//   node --import tsx evals/contract.mjs
//
// A directory with a package.json is the app's browser code, which the project
// loader skips too.
const infra = fileURLToPath(new URL("../infra", import.meta.url));
const resourceFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return existsSync(join(path, "package.json")) ? [] : resourceFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });

resetRegistry();
const stamp = Date.now();
for (const file of resourceFiles(infra))
  await import(`${pathToFileURL(file).href}?contract=${stamp}`);

const all = resources();
const ofKind = (kind) => all.filter((resource) => resource.kind === kind);

// The source: Cargo Signals engagement on tracked profiles, capped.
const connectors = ofKind("connector");
const signals = connectors.find(
  (connector) => connector.spec.integrationSlug === "cargoSignals",
);
assert.ok(signals, "a cargoSignals connector must exist");
const models = ofKind("model");
assert.ok(models.length >= 1, "at least one engagement model must exist");
for (const model of models) {
  const spec = JSON.stringify(model.spec);
  assert.equal(
    model.spec.datasetUuid?.resourceId,
    signals.id,
    `${model.id} must sync through the Cargo Signals connector`,
  );
  assert.ok(
    spec.includes('"listenInfluencerEngagement"'),
    `${model.id} must extract listenInfluencerEngagement`,
  );
  const cap = Number((spec.match(/"dailyLeadLimit":\s*(\d+)/) ?? [])[1]);
  assert.ok(
    cap > 0 && cap <= 1000,
    `${model.id} must carry a dailyLeadLimit: it is the spend cap, got ${cap}`,
  );
  assert.ok(
    /"linkedinUrls":\s*\[\s*"https:\/\/www\.linkedin\.com\/in\//.test(spec),
    `${model.id} must watch at least one LinkedIn profile URL`,
  );
}

// The board, and nothing that acts.
const apps = ofKind("app");
assert.equal(apps.length, 1, "exactly one defineApp: the board");
const [app] = apps;
assert.equal(
  isAbsolute(app.spec.path),
  false,
  "the app path must be relative: the deploy hashes the string",
);
for (const kind of ["play", "agent", "workflow", "tool"])
  assert.equal(
    ofKind(kind).length,
    0,
    `no ${kind}: the board reads, it never reaches an engager`,
  );

// The app's settings point at what is declared.
const appDir = join(process.cwd(), app.spec.path);
assert.ok(
  existsSync(join(appDir, "package-lock.json")),
  "the app package needs its lockfile",
);
const config = readFileSync(join(appDir, "src", "config.ts"), "utf8");
const dataset = (config.match(/DATASET\s*=\s*"([^"]+)"/) ?? [])[1];
assert.ok(
  connectors.some((connector) => connector.id === `connector:${dataset}`),
  `DATASET "${dataset}" in config.ts must be the Cargo Signals connector slug`,
);
const listed = [
  ...((config.match(/MODELS\s*=\s*\[([^\]]*)\]/) ?? [])[1] ?? "").matchAll(
    /"([^"]+)"/g,
  ),
].map((match) => match[1]);
assert.deepEqual(
  [...listed].sort(),
  models.map((model) => model.id.replace(/^model:/, "")).sort(),
  "MODELS in config.ts must list exactly the declared engagement models",
);

// No credential in the browser bundle.
const source = readdirSync(join(appDir, "src"), { recursive: true })
  .filter((file) => /\.tsx?$/.test(String(file)))
  .map((file) => readFileSync(join(appDir, "src", String(file)), "utf8"))
  .join("\n");
assert.equal(
  /CARGO_API_TOKEN|VITE_[A-Z_]*TOKEN|Bearer /.test(source),
  false,
  "the board queries as the signed-in viewer: no token in its source",
);

console.log(
  `ok: post-engagement contract (${models.length} models, 1 app, no actions)`,
);
