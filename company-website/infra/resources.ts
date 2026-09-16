import {
  defineAgent,
  defineApp,
  defineConnector,
  defineFolder,
} from "@cargo-ai/cdk";
import { readFileSync } from "node:fs";
import { appPath, settings } from "./settings";
import { maintainerPrompt } from "./agents/maintainer.prompt";
import {
  assertReady,
  assertUploadable,
} from "./apps/website/build-support.mjs";

// Each conditional owns its dependencies, so website-only mode does not
// deploy unused agents, connectors or folders. Removing an already-deployed
// resource is a deletion in the plan: do not toggle these flags to pause it.
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
    path: appPath,
    description: "Public website built from this project's reviewed source.",
    folder,
    // Public bundle: no Cargo SDK login, private context or browser secrets.
  });
}
