// The bare domain of a URL: what Exa returns is a page, and the TAM keys a
// website on its domain. A short or tracking link is no domain at all, so it
// comes back empty.

import { defineScript } from "@cargo-ai/cdk";

import { bareDomain, isSharedHost } from "./domains";

export const websiteDomain = defineScript(
  ({ url }: { url: string }): string => {
    const domain = bareDomain(url);
    if (isSharedHost(domain)) {
      return "";
    }
    return domain;
  },
);
