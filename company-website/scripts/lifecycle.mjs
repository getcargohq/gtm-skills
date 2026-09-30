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
  if (
    config.visitors !== undefined &&
    typeof config.visitors.enabled !== "boolean"
  )
    throw new Error("visitors.enabled must be an explicit boolean.");
  if (
    config.domain !== undefined &&
    (typeof config.domain.name !== "string" ||
      typeof config.domain.purchase !== "boolean")
  )
    throw new Error(
      "domain needs a name string (empty while off) and an explicit purchase boolean.",
    );
  if (
    config.domain !== undefined &&
    !["cargo", "external", undefined].includes(config.domain.dns)
  )
    throw new Error('domain.dns must be "cargo" (default) or "external".');
  if (config.domain?.dns === "external" && config.domain.purchase)
    throw new Error(
      'domain.purchase cannot be true with dns "external": Cargo can only buy a domain whose DNS it holds.',
    );
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
  const visitorConnector =
    config.visitors?.enabled && config.visitors.connectorUuid;
  if (!config.maintainer && !visitorConnector) return;
  const connectors = Array.isArray(response) ? response : response?.connectors;
  if (!Array.isArray(connectors))
    throw new Error("Unrecognized connector-list response.");
  if (
    visitorConnector &&
    !connectors.some(
      (c) =>
        c.uuid === visitorConnector &&
        c.integrationSlug === "snitcher" &&
        (!c.workspaceUuid || c.workspaceUuid === config.workspaceUuid),
    )
  )
    throw new Error(
      "The selected Snitcher connector is not in the target workspace.",
    );
  for (const integration of config.maintainer ? ["github", "anthropic"] : []) {
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

// With dns "cargo" the release publishes the domain's zone with defineDomain,
// which REPLACES every record — including the MX, SPF, DKIM and DMARC records
// a Cargo mailbox sends with. Refuse before a deploy can wipe them. An
// external zone stays at the company's provider and Cargo never writes it, so
// it is skipped. Pages through every mailbox because the CLI filters by domain
// uuid, which the config doesn't have; the email's domain is exact either way.
const MAILBOX_PAGE = 100;
export function assertDomainSendsNoMail(config, cargo) {
  if (!config.publish || !config.domain?.name) return;
  if (config.domain.dns === "external") return;
  const suffix = `@${config.domain.name.toLowerCase()}`;
  const senders = [];
  for (let offset = 0; ; offset += MAILBOX_PAGE) {
    const response = cargo([
      "mailboxManagement",
      "mailbox",
      "list",
      "--limit",
      String(MAILBOX_PAGE),
      "--offset",
      String(offset),
    ]);
    const mailboxes = response?.mailboxes;
    if (!Array.isArray(mailboxes))
      throw new Error("Unrecognized mailbox-list response.");
    for (const mailbox of mailboxes)
      if (String(mailbox.email).toLowerCase().endsWith(suffix))
        senders.push(mailbox.email);
    if (mailboxes.length < MAILBOX_PAGE) break;
  }
  if (senders.length)
    throw new Error(
      `${config.domain.name} sends mail from ${senders.length} Cargo mailbox(es) (${senders.slice(0, 3).join(", ")}${senders.length > 3 ? ", …" : ""}). ` +
        "Publishing the website replaces the domain's whole DNS zone, which would remove the MX, SPF, DKIM and DMARC records those mailboxes need. " +
        "Use a dedicated domain for the website — outreach reputation shouldn't touch it anyway — or add every mail record to the domain's dnsRecords in infra/company-website/resources.ts and remove this check deliberately.",
    );
}

// An app declaring domains stores the records its hostnames need as the
// `domainRecords` output: a JSON string of { type, name, value }[] with
// fully-qualified names, or "null" until a non-draft release attached them.
// Returns them with the zone-relative name an external DNS provider expects.
export function domainRecordsFromState(config, entry) {
  const name = config.domain?.name?.trim().toLowerCase();
  if (!name || config.domain.dns !== "external")
    throw new Error(
      'Declare domain.name with dns "external" in website.json. A Cargo-held domain publishes these records itself.',
    );
  if (!entry?.uuid)
    throw new Error(
      "The app is not deployed yet. Release it through the project's CDK workflow first.",
    );
  const raw = entry.outputs?.domainRecords;
  const records = raw === undefined ? null : JSON.parse(raw);
  if (records === null)
    throw new Error(
      `No DNS records for www.${name} yet. Run a non-draft release that declares the domain first.`,
    );
  if (
    !Array.isArray(records) ||
    !records.every(
      (r) =>
        typeof r?.type === "string" &&
        typeof r.name === "string" &&
        typeof r.value === "string",
    )
  )
    throw new Error("Unrecognized domainRecords output in Cargo state.");
  return records.map(({ type, name: fqdn, value }) => {
    const host = fqdn.toLowerCase().replace(/\.$/, "");
    if (host !== name && !host.endsWith(`.${name}`))
      throw new Error(`Record ${fqdn} is outside ${name}.`);
    return {
      type,
      name: fqdn,
      host: host === name ? "@" : host.slice(0, -(name.length + 1)),
      value,
    };
  });
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
