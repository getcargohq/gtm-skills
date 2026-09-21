import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const disabledVisitors = {
  enabled: false,
  siteUrl: "",
  privacyPolicyUrl: "",
  approvedScriptSha256: "",
};
export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");
export function readBrowserVisitors(root) {
  const file = join(root, "visitor-browser.json");
  return existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : disabledVisitors;
}
export function httpsSite(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Visitor tracking requires a public HTTPS site URL without credentials, query or fragment.",
    );
  return url;
}
export function validateBrowserVisitors(root) {
  const config = readBrowserVisitors(root);
  if (typeof config.enabled !== "boolean")
    throw new Error("Tracking needs an explicit enabled boolean.");
  if (!config.enabled) return config;
  const site = httpsSite(config.siteUrl);
  const privacy = new URL(config.privacyPolicyUrl, site);
  if (!config.privacyPolicyUrl || privacy.protocol !== "https:")
    throw new Error(
      "Set the reviewed privacy disclosure URL before enabling tracking.",
    );
  const script = readFileSync(
    join(root, "public/website-visitors-provider.js"),
    "utf8",
  );
  if (
    !/^[a-f0-9]{64}$/.test(config.approvedScriptSha256) ||
    sha256(script) !== config.approvedScriptSha256
  )
    throw new Error(
      "Review the captured provider script and approve its exact SHA256 before enabling tracking.",
    );
  return config;
}
export function assertVisitorBinding(root, visitors) {
  const browser = validateBrowserVisitors(root);
  if (visitors?.enabled) {
    httpsSite(visitors.siteUrl);
    if (browser.siteUrl && browser.siteUrl !== visitors.siteUrl)
      throw new Error(
        "The captured tracker belongs to another site. Review a provider migration instead of changing its URL in place.",
      );
    for (const key of ["connectorUuid", "snitcherWorkspaceUuid"])
      if (
        visitors[key] &&
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(visitors[key])
      )
        throw new Error(`Invalid visitors.${key}.`);
  }
  if (
    browser.enabled &&
    (!visitors?.enabled ||
      !visitors.snitcherWorkspaceUuid ||
      browser.siteUrl !== visitors.siteUrl)
  )
    throw new Error(
      "Browser tracking and the Cargo visitor models must target the same enabled website.",
    );
}
export function visitorTrackingPlugin(root) {
  return {
    name: "company-website-visitors",
    transformIndexHtml: {
      order: "pre",
      handler() {
        if (!validateBrowserVisitors(root).enabled) return [];
        return [
          {
            tag: "script",
            attrs: { type: "module", src: "/visitor-runtime.js" },
            injectTo: "body",
          },
        ];
      },
    },
  };
}
