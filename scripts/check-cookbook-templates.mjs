#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cargoCdk = join(root, "node_modules", ".bin", "cargo-cdk");
const enrichmentTemplate = join(
  root,
  "cookbooks",
  "account-enrichment",
  "cdk",
  "play",
);

if (existsSync(join(root, "cookbooks", "account-enrichment", "SKILL.md"))) {
  execFileSync(cargoCdk, ["check", "--dir", enrichmentTemplate], {
    stdio: "pipe",
  });
  process.stdout.write("ok: account-enrichment/template\n");
}

const variants = [
  ["account-deduplication", "hubspot"],
  ["account-deduplication", "salesforce"],
  ["account-deduplication", "attio"],
].filter(([cookbook]) =>
  existsSync(join(root, "cookbooks", cookbook, "SKILL.md")),
);

for (const [cookbook, crm] of variants) {
  const stage = mkdtempSync(join(tmpdir(), "gtm-skills-template-check-"));
  try {
    symlinkSync(join(root, "node_modules"), join(stage, "node_modules"), "dir");
    // Deduplication keeps one play per CRM because the candidate cluster
    // models are executable examples, not an agent-rewritten template.
    const target = join(stage, cookbook, crm);
    mkdirSync(target, { recursive: true });
    for (const resource of [
      "connectors",
      "models",
      "tools",
      "agents",
      "plays",
      "context",
    ]) {
      const resourceRoot = join(root, "cookbooks", cookbook, "cdk", resource);
      if (!existsSync(resourceRoot)) continue;
      for (const entry of readdirSync(resourceRoot, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".ts"))
          cpSync(join(resourceRoot, entry.name), join(target, entry.name));
      }
      const crmRoot = join(resourceRoot, crm);
      if (!existsSync(crmRoot)) continue;
      for (const filename of readdirSync(crmRoot)) {
        cpSync(join(crmRoot, filename), join(target, filename));
      }
    }
    for (const filename of readdirSync(target).filter((name) =>
      name.endsWith(".ts"),
    )) {
      const path = join(target, filename);
      const source = readFileSync(path, "utf8")
        .replaceAll(`../../tools/${crm}/`, "./")
        .replaceAll(`../../models/${crm}/`, "./");
      writeFileSync(path, source);
    }
    execFileSync(cargoCdk, ["check", "--dir", target], { stdio: "pipe" });
    process.stdout.write(`ok: ${cookbook}/${crm}\n`);
  } catch (error) {
    process.stderr.write(error.stdout?.toString() ?? "");
    process.stderr.write(error.stderr?.toString() ?? "");
    process.exitCode = 1;
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
