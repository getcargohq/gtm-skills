import {
  defineAgent,
  defineApp,
  defineConnector,
  defineFolder,
  defineModel,
  connectorRef,
} from "@cargo-ai/cdk";
import { readFileSync } from "node:fs";
import { relative, sep } from "node:path";
import { appPath, settings } from "./settings";
import { assertVisitorBinding } from "./apps/website/visitor-support.mjs";
import { maintainerPrompt } from "./agents/maintainer.prompt";
import {
  assertReady,
  assertUploadable,
} from "./apps/website/build-support.mjs";

// Each conditional owns its dependencies, so website-only mode does not
// deploy unused agents, connectors or folders. Removing an already-deployed
// resource is a deletion candidate: ordinary deploy retains it, --prune removes
// it. Review removal separately; changing a flag is not a runtime pause switch.
if (settings.maintainer) {
  // Rewire these handles to the project's existing declarations when present.
  // default:true adopts an authenticated connector; it cannot grant OAuth.
  const github = defineConnector("company_website_github", {
    integration: "github",
    default: true,
  });
  const anthropic = defineConnector("company_website_anthropic", {
    integration: "anthropic",
    default: true,
  });
  const folder = defineFolder("company-website-agents", {
    kind: "agent",
    name: "Company website",
  });
  defineAgent("company-website-maintainer", {
    name: "Company website maintainer",
    description:
      "Builds and updates the public website through reviewed pull requests.",
    harness: "claudeCode",
    connector: anthropic,
    languageModel: settings.languageModel,
    repository: {
      connector: github,
      // Blank while distributing: the CDK infers the consuming checkout.
      ...(settings.repository ? { repository: settings.repository } : {}),
      defaultBranch: settings.defaultBranch,
      rootDirectory: ".",
    },
    systemPrompt: maintainerPrompt,
    triggers: [],
    folder,
  });
}

const visitors = settings.visitors;
assertVisitorBinding(appPath, visitors);
if (visitors?.enabled) {
  // A discovered connector is referenced, never renamed or deleted by this app.
  // Otherwise CDK creates a dedicated Cargo credits-backed connector.
  const snitcher = visitors.connectorUuid
    ? connectorRef(visitors.connectorUuid)
    : defineConnector("company_website_snitcher", {
        name: "Company website visitors",
        integration: "snitcher",
      });
  const visitorFolder = defineFolder("company-website-models", {
    kind: "model",
    name: "Company website",
  });
  defineModel("company_website_visitors", {
    folder: visitorFolder,
    name: "Website visiting companies",
    connector: snitcher,
    extractSlug: "fetchOrganisations",
    config: { url: visitors.siteUrl },
    // Native autoFetch owns the incremental interval. No extra cron or play.
  });
  // The first release provisions the provider workspace. Capture its public
  // tracker and workspace UUID, review, then enable sessions in a second release.
  if (visitors.snitcherWorkspaceUuid) {
    defineModel("company_website_sessions", {
      folder: visitorFolder,
      name: "Website visitor sessions",
      connector: snitcher,
      extractSlug: "fetchSessions",
      config: { workspaceUuid: visitors.snitcherWorkspaceUuid },
    });
  }
}

if (settings.publish) {
  assertUploadable(appPath);
  const content = JSON.parse(readFileSync(`${appPath}/site.json`, "utf8"));
  assertReady(content);
  if (
    content.status !== "ready" ||
    !settings.workspaceUuid ||
    !settings.repository
  ) {
    throw new Error(
      "Bind this project and approve site.json before enabling publication.",
    );
  }
  const folder = defineFolder("company-website-apps", {
    kind: "app",
    name: "Company website",
  });
  defineApp(settings.appSlug, {
    name: "Company website",
    // CDK hashes the path string. Keep it stable across local and CI checkouts.
    path: relative(process.cwd(), appPath).split(sep).join("/"),
    description: "Public website built from this project's reviewed source.",
    folder,
    // Public bundle: no Cargo SDK login, private context or browser secrets.
  });
}
