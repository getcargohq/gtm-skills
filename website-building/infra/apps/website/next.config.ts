import type { NextConfig } from "next";

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
  },
};

export default config;
