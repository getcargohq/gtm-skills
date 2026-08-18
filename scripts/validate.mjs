#!/usr/bin/env node
// The repo's own gates, in one place: `node scripts/validate.mjs`.
//
// Deliberately NOT an npm script. `package.json` is in cargo.scaffold.json's
// `shared` list, so it is copied into every project that scaffolds a cookbook,
// and `scripts/` is not. An `npm run validate` there used to fail with
// "Cannot find module .../scripts/check-scaffold.mjs" on the customer's first
// day. Everything left in package.json `scripts` works in a scaffolded project.
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = resolve(dirname(fileURLToPath(import.meta.url)));
for (const script of [
  "check-scaffold.mjs",
  "check-cookbooks.mjs",
  "routing-eval.mjs",
]) {
  execFileSync(
    process.execPath,
    [join(here, script), ...process.argv.slice(2)],
    {
      stdio: "inherit",
    },
  );
}
