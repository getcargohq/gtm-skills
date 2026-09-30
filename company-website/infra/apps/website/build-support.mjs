import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

// Shared by the build marker and release verification. Built output, local
// dependencies and Next.js generated files are excluded so a clean reinstall
// and build yield the same source identity.
const GENERATED = [
  "node_modules",
  "dist",
  "out",
  "build",
  ".next",
  ".git",
  ".turbo",
  ".DS_Store",
  "next-env.d.ts",
];
export function sourceHash(root) {
  const hash = createHash("sha256");
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (
        GENERATED.includes(entry.name) ||
        entry.name.startsWith(".env") ||
        entry.name.endsWith(".tsbuildinfo")
      )
        continue;
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(
          "App sources must not depend on symbolic links outside the package.",
        );
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  walk(root);
  for (const file of files.sort())
    hash
      .update(relative(root, file).split("\\").join("/"))
      .update("\0")
      .update(readFileSync(file))
      .update("\0");
  return hash.digest("hex");
}

export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

export function validateContent(site) {
  for (const key of ["companyName", "eyebrow", "headline", "description"]) {
    if (typeof site[key] !== "string" || !site[key].trim())
      throw new Error(`Missing site content: ${key}`);
  }
  if (!["draft", "ready"].includes(site.status))
    throw new Error("Site status must be draft or ready.");
  if (
    !site.cta?.label ||
    typeof site.cta.href !== "string" ||
    !/^(https:\/\/|mailto:|#approach$|\/about\/$)/.test(site.cta.href)
  )
    throw new Error(
      "CTA must use an HTTPS, mailto, approach-section or about-page destination.",
    );
  if (
    site.canonicalUrl &&
    !/^https:\/\/[a-z0-9.-]+(?::\d+)?\/$/i.test(site.canonicalUrl)
  )
    throw new Error(
      "Canonical URL must be the verified HTTPS public origin, ending in /.",
    );
  if (
    !Array.isArray(site.features) ||
    site.features.length < 1 ||
    site.features.some((f) => !f.title || !f.body)
  )
    throw new Error("At least one complete feature is required.");
  const about = site.about;
  if (
    !about ||
    typeof about.title !== "string" ||
    !about.title.trim() ||
    typeof about.description !== "string" ||
    !about.description.trim() ||
    !Array.isArray(about.body) ||
    about.body.length < 1 ||
    about.body.some((p) => typeof p !== "string" || !p.trim())
  )
    throw new Error(
      "The about page needs a title, description and at least one paragraph.",
    );
}

export function assertReady(site) {
  validateContent(site);
  if (site.status !== "ready")
    throw new Error(
      "Publication requires reviewed site.json with status ready.",
    );
  const draft = /your company|replace this draft|replace me|lorem ipsum/i;
  for (const key of ["companyName", "headline", "description"]) {
    if (draft.test(site[key]))
      throw new Error(`Replace draft company content: ${key}.`);
  }
  if (draft.test(site.about.description))
    throw new Error("Replace draft company content: about.description.");
  if (/example\.(com|org|invalid)/i.test(site.cta.href))
    throw new Error("Use the agreed real CTA destination.");
}

// The pinned CDK uploads {path, content:string} using UTF-8 reads. A successful
// local Next.js build cannot prove these bytes survive that transport. The
// hosting build also needs package.json and its lockfile at the root.
export function assertUploadable(root) {
  for (const file of ["package.json", "package-lock.json"])
    if (!existsSync(join(root, file)))
      throw new Error(`The website app is missing ${file} at its root.`);
  // The CDK uploads every file except node_modules, dist, build and .next. A
  // leftover Next.js export would ride along and change the deployment hash.
  if (existsSync(join(root, "out")))
    throw new Error(
      "Remove the stale out/ export; the build script moves it to dist/.",
    );
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (GENERATED.includes(entry.name)) continue;
      const file = join(dir, entry.name);
      if (entry.isSymbolicLink())
        throw new Error("Public app bundles must not include symbolic links.");
      if (entry.name.startsWith(".env"))
        throw new Error(
          "Remove app-local .env files before Cargo upload; browser build variables are public.",
        );
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) {
        const bytes = readFileSync(file);
        if (!bytes.equals(Buffer.from(bytes.toString("utf8"), "utf8")))
          throw new Error(
            `Cargo's text upload cannot preserve ${relative(root, file)}. Use a reviewed text-safe data URL, SVG or approved external asset; preserve the original outside the public bundle.`,
          );
      }
    }
  }
  walk(root);
}

// Run after `next build` on the exported dist/. The verifier compares this
// marker with the reviewed source; a missing page means the export is broken.
export function writeBuildMarker(root, output) {
  for (const page of [
    "index.html",
    "about/index.html",
    "robots.txt",
    "sitemap.xml",
  ])
    if (!existsSync(join(output, page)))
      throw new Error(
        `The static export has no ${page}. Keep output: "export" and trailingSlash: true in next.config.ts.`,
      );
  writeFileSync(
    join(output, "website-build.json"),
    JSON.stringify({ version: 1, sourceSha256: sourceHash(root) }) + "\n",
  );
}
