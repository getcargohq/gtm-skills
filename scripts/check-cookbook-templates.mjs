#!/usr/bin/env node
// Checks the single executable template shipped by cookbook-account-enrichment.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cargoCdk = join(root, "node_modules", ".bin", "cargo-cdk");
const cookbook = join(root, "cookbook-account-enrichment");
const templateDir = join(cookbook, "infra");

if (!existsSync(join(cookbook, "SKILL.md"))) process.exit(0);

try {
  execFileSync(cargoCdk, ["check", "--dir", templateDir], {
    stdio: "pipe",
  });
  const plan = JSON.parse(
    execFileSync(cargoCdk, ["plan", "--dir", templateDir, "--json"], {
      encoding: "utf8",
    }),
  );
  if (!Array.isArray(plan.errors) || plan.errors.length > 0) {
    throw new Error(
      `cargo-cdk plan returned errors: ${JSON.stringify(plan.errors)}`,
    );
  }
  process.stdout.write("ok: cookbook-account-enrichment/template\n");
} catch (error) {
  process.stderr.write(error.stdout?.toString() ?? "");
  process.stderr.write(error.stderr?.toString() ?? "");
  if (!error.stdout && !error.stderr)
    process.stderr.write(`${error.message ?? String(error)}\n`);
  process.exitCode = 1;
}
