// The bare domain of a URL: what Exa returns is a page, and the TAM keys a
// website on its domain. "https://www.acme.example/about" becomes
// "acme.example".
//
// A company page sometimes lists a short or tracking link as its website
// ("bit.ly/…", "eu1.hubs.ly/…"). Thousands of unrelated companies share those
// hosts, so one of them is no domain at all: it would match the wrong CRM
// account and merge unrelated companies. It comes back empty.

import { defineScript } from "@cargo-ai/cdk";

const SHARED_HOSTS = [
  "bit.ly",
  "buff.ly",
  "facebook.com",
  "github.com",
  "goo.gl",
  "google.com",
  "hubs.ly",
  "hubs.la",
  "instagram.com",
  "linkedin.com",
  "linktr.ee",
  "lnkd.in",
  "ow.ly",
  "t.co",
  "tinyurl.com",
];

export const websiteDomain = defineScript(
  ({ url }: { url: string }): string => {
    if (!url) {
      return "";
    }
    const withoutScheme = url.trim().replace(/^https?:\/\//i, "");
    const host = withoutScheme.split(/[/?#]/)[0].toLowerCase();
    const domain = host.replace(/^www\./, "");
    const isShared = SHARED_HOSTS.some(
      (shared) => domain === shared || domain.endsWith(`.${shared}`),
    );
    if (isShared) {
      return "";
    }
    return domain;
  },
);
