#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  assertStateBound,
  gitRepository,
  inspectLive,
  readConfig,
  verifyConnectors,
  verifyIdentity,
  verifyPublic,
} from "./lifecycle.mjs";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    project: { type: "string", default: "." },
    "cdk-dir": { type: "string", default: "infra" },
  },
});
const project = resolve(values.project);
const cdkDir = resolve(project, values["cdk-dir"]);
const infra = join(project, "infra/company-website");
const app = join(infra, "apps/website");
function run(bin, args, cwd = project) {
  execFileSync(bin, args, { cwd, stdio: "inherit" });
}
function cargo(args) {
  const local = join(project, "node_modules/.bin/cargo-ai");
  const output = execFileSync(existsSync(local) ? local : "cargo-ai", args, {
    cwd: project,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(
      `Cargo returned non-JSON output for ${args.slice(0, 3).join(" ")}. Inspect the installed CLI.`,
    );
  }
}

try {
  const config = readConfig(infra);
  const support = await import(
    pathToFileURL(join(app, "build-support.mjs")).href
  );
  if (config.publish) {
    support.assertUploadable(app);
    support.assertReady(
      JSON.parse(readFileSync(join(app, "site.json"), "utf8")),
    );
  }
  const command = positionals[0];
  if (!["check", "doctor", "plan", "verify"].includes(command))
    throw new Error(
      "Usage: node scripts/company-website/website.mjs check|doctor|plan|verify [--cdk-dir infra]",
    );
  if (command === "check") {
    support.assertUploadable(app);
    run("npm", ["run", "check"], app);
    run("npm", ["run", "build"], app);
    const result = cargo(["cdk", "check", "--dir", cdkDir, "--json"]);
    if (
      !Array.isArray(result?.nodes) ||
      !Array.isArray(result?.loadErrors) ||
      !Array.isArray(result?.compile?.errors)
    )
      throw new Error(
        "Unrecognized CDK check response. No successful check was assumed.",
      );
    if (result.loadErrors?.length || result.compile?.errors?.length)
      throw new Error(
        "CDK check failed. Run cargo-ai cdk check to inspect diagnostics.",
      );
    console.log(
      JSON.stringify(
        {
          offline: true,
          nodes: result.nodes?.map((n) => n.id),
          browser: "unverified: run the QA checklist",
        },
        null,
        2,
      ),
    );
  } else {
    const identity = cargo(["whoami"]);
    verifyIdentity(config, identity, gitRepository(project));
    verifyConnectors(
      config,
      config.maintainer ? cargo(["connection", "connector", "list"]) : [],
    );
    const target = {
      workspaceUuid: identity.workspace.uuid,
      workspaceUrl: `https://app.getcargo.io/workspaces/${identity.workspace.uuid}`,
      repository: config.repository,
    };
    if (command === "doctor")
      console.log(
        JSON.stringify(
          {
            ...target,
            statePresent: existsSync(join(cdkDir, "cargo.state.json")),
            publish: config.publish,
            maintainer: config.maintainer,
            modelAvailability:
              "Confirm the chosen model in Cargo before the first agent run.",
          },
          null,
          2,
        ),
      );
    else if (command === "plan") {
      assertStateBound(project, cdkDir);
      const plan = cargo(["cdk", "plan", "--dir", cdkDir, "--json"]);
      if (!Array.isArray(plan?.errors) || !Array.isArray(plan?.plan))
        throw new Error(
          "Unrecognized CDK plan response. Inspect the installed CLI.",
        );
      if (plan.errors?.length)
        throw new Error(
          "CDK plan has errors. Inspect cargo-ai cdk plan before any release.",
        );
      console.log(JSON.stringify({ ...target, plan }, null, 2));
    } else {
      if (!config.publish) throw new Error("Website publication is disabled.");
      const live = inspectLive(config, cargo);
      const verification = await verifyPublic(live, support.sourceHash(app));
      console.log(
        JSON.stringify(
          {
            ...target,
            ...live,
            ...verification,
            browserAndForms:
              "Verify the actual URL with references/qa-checklist.md before claiming full release acceptance.",
          },
          null,
          2,
        ),
      );
    }
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Website check failed.",
  );
  process.exitCode = 1;
}
