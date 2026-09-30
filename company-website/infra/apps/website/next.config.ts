import type { NextConfig } from "next";

import { visitorConsentConfig } from "./visitor-support.mjs";

// Tracking stays out of the bundle unless visitor-browser.json is enabled and
// its provider script matches the approved hash (this throws otherwise).
const visitors = visitorConsentConfig(import.meta.dirname);

// Cargo Hosting serves static files only. `next build` writes the export to
// out/, and the package build script moves it to dist/, where Cargo reads it.
// trailingSlash writes /about as about/index.html. Cargo's build sees pages
// in that layout and routes the deployment statically, so /about and /about/
// both serve it. Without trailingSlash, /about would serve the home page.
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    // The app is its own package; do not resolve from a parent lockfile.
    root: import.meta.dirname,
    resolveAlias: {
      "@visitor-consent": visitors
        ? "./components/visitor-consent.tsx"
        : "./components/visitor-consent-off.tsx",
    },
  },
};

export default config;
