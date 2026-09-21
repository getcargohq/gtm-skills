#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getApi } from "@cargo-ai/cdk/cli";
import { statePath } from "@cargo-ai/cdk/deploy";
import {
  assertStateBound,
  gitRepository,
  readConfig,
  verifyIdentity,
} from "./lifecycle.mjs";

// Convert the provider's installation snippet to a reviewable local JS asset.
// Capture never executes it. Unknown HTML and third-party script hosts fail.
export function providerJavascript(snippet) {
  if (typeof snippet !== "string" || !snippet.trim() || snippet.length > 100000)
    throw new Error("Missing or unsupported Snitcher installation snippet.");
  const tags = [
    ...snippet.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi),
  ];
  const remainder = snippet
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .trim();
  if (!tags.length || remainder)
    throw new Error(
      "Unknown Snitcher snippet format. Inspect it before adapting the parser.",
    );
  // Cargo currently returns one classic inline bootstrap. Keep its top-level
  // scope intact; wrapping it in a function changes provider global variables.
  if (
    tags.length !== 1 ||
    /\bsrc\s*=|\bon\w+\s*=/i.test(tags[0][1]) ||
    /type\s*=\s*["']module["']/i.test(tags[0][1])
  )
    throw new Error(
      "Unsupported provider script format. Review and adapt it explicitly.",
    );
  const body = tags[0][2].trim();
  const call = /\}\((\{[\s\S]*\})\);?\s*$/.exec(body);
  if (!body.startsWith("!function(") || !call)
    throw new Error(
      "Unknown Snitcher bootstrap. Review its configuration before capture.",
    );
  const settings = JSON.parse(call[1]);
  if (
    settings.namespace !== "Snitcher" ||
    settings.apiEndpoint !== "radar.snitcher.com" ||
    settings.cdn !== "cdn.snitcher.com" ||
    typeof settings.profileId !== "string" ||
    !/^[a-zA-Z0-9_-]+$/.test(settings.profileId)
  )
    throw new Error(
      "Unsupported Snitcher namespace, endpoints or public profile ID.",
    );
  // Radar merges these loader settings after remote settings. Cargo's generated
  // profile can otherwise turn on form/click capture by default. Keep the
  // provider bootstrap intact and apply documented feature configuration only.
  settings.waitForConsent = true;
  settings.features = {
    ...settings.features,
    formTracking: false,
    clickTracking: false,
    downloadTracking: false,
    sessionRecording: false,
    errorCapture: false,
  };
  return `// Cargo-provided Snitcher bootstrap with reviewed company/page-only settings.\n${body.slice(0, call.index)}}(${JSON.stringify(settings, null, 2)});\n`;
}

export async function operate(
  command,
  project = process.cwd(),
  dependencies = {},
) {
  const infra = join(project, "infra/company-website");
  const app = join(infra, "apps/website");
  const config = readConfig(infra);
  const cargo =
    dependencies.cargo ??
    ((args) =>
      JSON.parse(
        execFileSync(join(project, "node_modules/.bin/cargo-ai"), args, {
          cwd: project,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          maxBuffer: 16 * 1024 * 1024,
        }),
      ));
  verifyIdentity(config, cargo(["whoami"]), gitRepository(project));
  const api = dependencies.api ?? getApi();
  if (command === "inspect") {
    const { integration } = cargo([
      "connection",
      "integration",
      "get",
      "snitcher",
    ]);
    const { connectors } = await api.connection.connector.list({
      integrationSlug: "snitcher",
    });
    return {
      enabled: config.visitors?.enabled === true,
      managedCreditsSupported: integration.connector.credits.isCompatible,
      extractors: Object.fromEntries(
        ["fetchOrganisations", "fetchSessions"].map((key) => [
          key,
          {
            mode: integration.extractors[key].mode,
            credits: integration.extractors[key].credits,
          },
        ]),
      ),
      connectors: connectors.map(({ uuid, name, slug, isDefault }) => ({
        uuid,
        name,
        slug,
        isDefault,
      })),
      next: "After explicit opt-in, reuse a verified Cargo-managed connector UUID or leave it empty for a dedicated CDK connector. Native autoFetch starts on model creation; inspect current billing before release. BYO Snitcher keys require a separate adapter.",
    };
  }
  if (!config.visitors?.enabled)
    throw new Error(
      "Visitor tracking is disabled. Ask the operator before enabling it.",
    );
  assertStateBound(project, join(project, "infra"));
  const pointer = JSON.parse(
    readFileSync(statePath(join(project, "infra")), "utf8"),
  );
  if (!pointer.stateUuid)
    throw new Error("Expected the existing workspace-held state pointer.");
  const { state } = await api.workspaceManagement.state.get(pointer.stateUuid);
  const resources = state.contents.resources;
  const companies = resources?.["model:company_website_visitors"];
  if (!companies?.uuid)
    throw new Error(
      "Release the visitor company model through the project's CDK workflow first.",
    );
  const { model } = await api.storage.model.get(companies.uuid);
  if (
    model.extractorSlug !== "fetchOrganisations" ||
    model.config.url !== config.visitors.siteUrl
  )
    throw new Error(
      "The deployed model does not match the configured website.",
    );
  if (command === "capture") {
    const { sha256, readBrowserVisitors } = await import(
      pathToFileURL(join(app, "visitor-support.mjs"))
    );
    const workspaceUuid = model.config._workspaceUuid;
    if (
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
        workspaceUuid ?? "",
      )
    )
      throw new Error(
        "Cargo did not provision a Snitcher workspace. Inspect model status; do not create another model.",
      );
    const script = providerJavascript(model.config._trackingScript);
    const target = join(app, "public/website-visitors-provider.js");
    if (existsSync(target) && readFileSync(target, "utf8") !== script)
      throw new Error(
        "Captured provider script changed. Review and archive the existing file before replacing it.",
      );
    mkdirSync(join(app, "public"), { recursive: true });
    writeFileSync(target, script);
    const browser = readBrowserVisitors(app);
    if (
      browser.enabled &&
      (browser.siteUrl !== config.visitors.siteUrl ||
        browser.approvedScriptSha256 !== sha256(script))
    )
      throw new Error("Existing browser approval does not match this capture.");
    writeFileSync(
      join(app, "visitor-browser.json"),
      JSON.stringify(
        { ...browser, siteUrl: config.visitors.siteUrl },
        null,
        2,
      ) + "\n",
    );
    writeFileSync(
      join(infra, "website.json"),
      JSON.stringify(
        {
          ...config,
          visitors: {
            ...config.visitors,
            snitcherWorkspaceUuid: workspaceUuid,
          },
        },
        null,
        2,
      ) + "\n",
    );
    return {
      modelUuid: model.uuid,
      snitcherWorkspaceUuid: workspaceUuid,
      scriptFile: target,
      scriptSha256: sha256(script),
      browserEnabled: browser.enabled,
      next: "Review the saved script, provider settings and privacy disclosure. Put its exact hash in visitor-browser.json approvedScriptSha256 and set enabled:true only for the approved release. Session model joins the next CDK plan.",
    };
  }
  if (command === "status") {
    const reports = [];
    for (const id of [
      "model:company_website_visitors",
      "model:company_website_sessions",
    ]) {
      const entry = resources[id];
      if (!entry) {
        reports.push({ id, status: "not deployed" });
        continue;
      }
      const { model: current } = await api.storage.model.get(entry.uuid);
      const { datasets } = await api.storage.dataset.all();
      const dataset = datasets.find((d) => d.uuid === current.datasetUuid);
      if (
        !dataset ||
        !/^[a-zA-Z0-9_]+$/.test(dataset.slug) ||
        !/^[a-zA-Z0-9_]+$/.test(current.slug)
      )
        throw new Error(
          "Unsupported storage identifiers; inspect the models directly.",
        );
      const count = cargo([
        "storage",
        "query",
        "execute",
        `SELECT COUNT(*) AS records FROM ${dataset.slug}.${current.slug}`,
      ]);
      reports.push({
        id,
        modelUuid: current.uuid,
        modelUrl: `https://app.getcargo.io/workspaces/${config.workspaceUuid}/models/${current.uuid}`,
        count,
        runs: cargo(["storage", "run", "list", "--model-uuid", current.uuid]),
      });
    }
    return {
      models: reports,
      note: "Zero rows can mean no company was identified yet. A browser request alone does not prove ingestion. No synthetic records are inserted.",
    };
  }
  throw new Error(
    "Usage: node scripts/company-website/visitors.mjs inspect|capture|status",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(JSON.stringify(await operate(process.argv[2]), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
