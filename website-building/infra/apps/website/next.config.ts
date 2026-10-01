import type { NextConfig } from "next";

// Cargo Hosting serves static files only. `next build` writes the export to
// out/, and the package build script moves it to dist/, where Cargo reads it.
// trailingSlash writes /about as about/index.html, so links, canonicals and the
// sitemap all use /about/. Cargo serves a path from the file exported for it:
// /about and /about/ both reach about/index.html.
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
