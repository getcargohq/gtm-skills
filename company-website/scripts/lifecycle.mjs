import { execFileSync } from "node:child_process";
import { statePath } from "@cargo-ai/cdk/deploy";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

export function readConfig(infra) {
  const config = JSON.parse(readFileSync(join(infra, "website.json"), "utf8"));
  if (
    config.version !== 1 ||
    typeof config.publish !== "boolean" ||
    typeof config.maintainer !== "boolean"
  )
    throw new Error("Unsupported website.json configuration.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.appSlug))
    throw new Error("Choose a stable Cargo app slug.");
  if (!config.defaultBranch || (config.maintainer && !config.languageModel))
    throw new Error("A default branch and maintainer model are required.");
  return config;
}

export function repositoryFromOrigin(origin) {
  const match = origin
    .trim()
    .match(
      /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/,
    );
  if (!match)
    throw new Error(
      "Expected a GitHub origin. Inspect the checkout before configuring this pipeline.",
    );
  return match[1];
}

export function gitRepository(project) {
  return repositoryFromOrigin(
    execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: project,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
}

export function verifyIdentity(config, identity, repository) {
  if (
    !config.workspaceUuid ||
    identity?.workspace?.uuid?.toLowerCase() !==
      config.workspaceUuid.toLowerCase()
  )
    throw new Error("Cargo token does not match website.json workspaceUuid.");
  if (
    !config.repository ||
    repository.toLowerCase() !== config.repository.toLowerCase()
  )
    throw new Error(
      "Git origin does not match website.json repository. Bind the consuming fork before planning.",
    );
}

export function verifyConnectors(config, response) {
  if (!config.maintainer) return;
  const connectors = Array.isArray(response) ? response : response?.connectors;
  if (!Array.isArray(connectors))
    throw new Error("Unrecognized connector-list response.");
  for (const integration of ["github", "anthropic"]) {
    const matches = connectors.filter(
      (c) =>
        c.integrationSlug === integration &&
        c.isDefault === true &&
        (!c.workspaceUuid || c.workspaceUuid === config.workspaceUuid),
    );
    if (matches.length !== 1)
      throw new Error(
        `Select one authenticated default ${integration} connector, or adapt this check with the resource's explicit binding.`,
      );
  }
}

export function assertStateBound(project, cdkDir) {
  const file = statePath(cdkDir);
  // A deleted committed pointer must not make the CDK fall back to another
  // location or treat an established project as a fresh installation.
  for (const candidate of new Set([
    file,
    join(project, "cargo.state.json"),
    join(cdkDir, "cargo.state.json"),
  ])) {
    if (existsSync(candidate)) continue;
    let committed = false;
    try {
      execFileSync(
        "git",
        [
          "cat-file",
          "-e",
          `HEAD:${relative(project, candidate).split("\\").join("/")}`,
        ],
        { cwd: project, stdio: "ignore" },
      );
      committed = true;
    } catch {}
    if (committed)
      throw new Error(
        "The committed state pointer is missing. Restore it; do not create replacement state.",
      );
  }
  if (!existsSync(file))
    throw new Error(
      "Cargo state is absent. Bind existing state, or initialize state through the CLI for a genuinely new project.",
    );
  const state = JSON.parse(readFileSync(file, "utf8"));
  if (!state.stateUuid && !state.resources)
    throw new Error(
      "Cargo state is unbound. Use the installed CLI state commands.",
    );
  return file;
}

export function inspectLive(config, cargo) {
  const response = cargo(["hosting", "app", "list"]);
  const apps = Array.isArray(response) ? response : response?.apps;
  if (!Array.isArray(apps)) throw new Error("Unrecognized app-list response.");
  const matches = apps.filter(
    (a) =>
      a.slug === config.appSlug && a.workspaceUuid === config.workspaceUuid,
  );
  if (matches.length !== 1)
    throw new Error(
      "Expected exactly one app with this slug in the selected workspace.",
    );
  const app = matches[0];
  const result = cargo([
    "hosting",
    "deployment",
    "get-promoted",
    "--app-uuid",
    app.uuid,
  ]);
  const deployment = result?.deployment ?? result;
  if (
    deployment?.status !== "success" ||
    !deployment.promotedAt ||
    deployment.appUuid !== app.uuid
  )
    throw new Error("No successful promoted deployment for this app.");
  const url = new URL(app.url);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Cargo did not return a public HTTPS URL.");
  return { appUuid: app.uuid, deploymentUuid: deployment.uuid, url: url.href };
}

export async function verifyPublic(live, expectedHash, request = fetch) {
  const options = {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  };
  const html = await request(live.url, options);
  if (
    html.status !== 200 ||
    !(html.headers.get("content-type") ?? "").includes("text/html")
  )
    throw new Error("Anonymous request did not return HTML 200.");
  const marker = await request(new URL("/website-build.json", live.url), {
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  if (!marker.ok) throw new Error("Live build marker is unavailable.");
  const content = await marker.json();
  if (content.version !== 1 || content.sourceSha256 !== expectedHash)
    throw new Error("Live app does not match the reviewed source.");
  return { anonymousHttp: html.status, sourceMatch: true };
}
