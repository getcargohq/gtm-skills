/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// PLACEHOLDER: adapt website.json from the authenticated workspace, the fork's
// git origin and its default branch. Select an available Anthropic model.
// Keep publish false until the brief, preview and publication are approved.
export const settings: {
  version: number;
  workspaceUuid: string;
  repository: string;
  defaultBranch: string;
  appSlug: string;
  publish: boolean;
  maintainer: boolean;
  languageModel: string;
  // Off while name is empty. The site is served on www.<name>.
  // dns "cargo" (default): Cargo holds the domain and publishes its zone, with
  // the apex redirecting to www. purchase: true buys it with Cargo credits
  // (not refundable); otherwise an already-owned Cargo domain is adopted.
  // dns "external": the zone stays at the company's DNS provider; Cargo only
  // attaches www to the app and the operator adds its records there.
  domain?: {
    name: string;
    purchase: boolean;
    dns?: "cargo" | "external";
  };
  visitors?: {
    enabled: boolean;
    siteUrl: string;
    connectorUuid: string;
    snitcherWorkspaceUuid: string;
  };
} = JSON.parse(
  readFileSync(new URL("./website.json", import.meta.url), "utf8"),
);

const domainName = settings.domain?.name?.trim().toLowerCase() ?? "";
if (
  domainName &&
  (domainName.startsWith("www.") ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
      domainName,
    ))
)
  throw new Error(
    `website.json domain.name "${domainName}" must be the registrable domain, e.g. "acme.com"; the site is served on its www host.`,
  );
if (settings.domain && typeof settings.domain.purchase !== "boolean")
  throw new Error("website.json domain.purchase must be an explicit boolean.");
const dns = settings.domain?.dns ?? "cargo";
if (dns !== "cargo" && dns !== "external")
  throw new Error('website.json domain.dns must be "cargo" or "external".');
if (dns === "external" && settings.domain?.purchase === true)
  throw new Error(
    'website.json domain.purchase cannot be true with dns "external": Cargo can only buy a domain whose DNS it holds.',
  );

/** The domain to serve, or undefined while the block is off. */
export const domain = domainName
  ? {
      name: domainName,
      host: `www.${domainName}`,
      purchase: settings.domain?.purchase === true,
      dns,
    }
  : undefined;

export const appPath = fileURLToPath(
  new URL("./apps/website", import.meta.url),
);
