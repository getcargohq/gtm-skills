import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

// Shared by Vite and release verification. Built output and local dependencies
// are excluded so a clean reinstall yields the same source identity.
export function sourceHash(root) {
  const hash = createHash("sha256");
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (
        [
          "node_modules",
          "dist",
          "build",
          ".next",
          ".git",
          ".turbo",
          ".DS_Store",
        ].includes(entry.name) ||
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
    !/^(https:\/\/|mailto:|#approach$)/.test(site.cta.href)
  )
    throw new Error(
      "CTA must use an HTTPS, mailto or existing approach-section destination.",
    );
  if (site.canonicalUrl && !/^https:\/\/[^\s]+$/.test(site.canonicalUrl))
    throw new Error("Canonical URL must be the verified HTTPS public origin.");
  if (
    !Array.isArray(site.features) ||
    site.features.length < 1 ||
    site.features.some((f) => !f.title || !f.body)
  )
    throw new Error("At least one complete feature is required.");
}

export function assertReady(site) {
  validateContent(site);
  if (site.status !== "ready")
    throw new Error(
      "Publication requires reviewed site.json with status ready.",
    );
  for (const key of ["companyName", "headline", "description"]) {
    if (
      /your company|replace this draft|replace me|lorem ipsum/i.test(site[key])
    )
      throw new Error(`Replace draft company content: ${key}.`);
  }
  if (/example\.(com|org|invalid)/i.test(site.cta.href))
    throw new Error("Use the agreed real CTA destination.");
}

// The pinned CDK uploads {path, content:string} using UTF-8 reads. A successful
// local Vite build cannot prove these bytes survive that transport.
export function assertUploadable(root) {
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (
        ["node_modules", "dist", "build", ".next", ".git", ".turbo"].includes(
          entry.name,
        )
      )
        continue;
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
