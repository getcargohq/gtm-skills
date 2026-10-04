// Every pipeline that needs accounts, contacts, opportunities or activities
// declares the same Cargo native model under the same slug, so a project that
// installs several keeps one model of each. This check compiles each
// pipeline's infra/models and fails when a `gtm_*` model drifts from
// scripts/native-models.json, or when a pipeline declares a native model under
// a slug the workspace already owns (`accounts`, `contacts`: the built-in
// unify models).
//
// Run with: node --import tsx scripts/check-native-models.mjs
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resetRegistry, resources } from "@cargo-ai/cdk";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { models: canonical, knownCollisions = {} } = JSON.parse(
  readFileSync(join(root, "scripts", "native-models.json"), "utf8"),
);
// Slugs the native dataset already carries in every workspace.
const RESERVED = new Set([
  "accounts",
  "contacts",
  "account_events",
  "contact_events",
]);

const errors = [];
let checked = 0;

const pipelines = readdirSync(root).filter((name) =>
  existsSync(join(root, name, "infra", "models")),
);

for (const name of pipelines) {
  const dir = join(root, name, "infra", "models");
  resetRegistry();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    await import(`${pathToFileURL(join(dir, file)).href}?native=${Date.now()}`);
  }
  for (const resource of resources()) {
    if (!resource.id.startsWith("model:")) continue;
    const spec = resource.spec;
    if (spec.datasetUuid !== "native") continue;
    const where = `${name}: model ${spec.slug}`;

    if (RESERVED.has(spec.slug) && !(name in knownCollisions)) {
      errors.push(
        `${where} collides with the workspace's built-in native model of that slug; use the gtm_ model instead`,
      );
      continue;
    }
    if (RESERVED.has(spec.slug)) continue;

    const expected = canonical[spec.slug];
    if (!expected) continue;
    checked += 1;

    if (spec.extractorSlug !== expected.extractorSlug) {
      errors.push(
        `${where} uses ${spec.extractorSlug}, the shared model is ${expected.extractorSlug}`,
      );
    }
    if (spec.name !== expected.name) {
      errors.push(
        `${where} is named "${spec.name}", the shared model is "${expected.name}"`,
      );
    }
    if (expected.columns) {
      const got = JSON.stringify(spec.config?.columns ?? []);
      const want = JSON.stringify(expected.columns);
      if (got !== want) {
        errors.push(
          `${where} columns differ from scripts/native-models.json: copy the shared definition verbatim`,
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error("native models are out of line:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `ok: ${checked} shared native model declaration(s) match scripts/native-models.json`,
);
