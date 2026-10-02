/// <reference types="node" />
import { defineApp } from "@cargo-ai/cdk";
import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { appsFolder } from "../folders";

// The public website: the Next.js package in `./website/`, exported statically.
//
// Cargo uploads that directory and runs its `build` script on deploy:
// `next build` writes the static export to out/, and the script moves it to
// dist/, where Cargo Hosting reads it. `trailingSlash: true` in
// `website/next.config.ts` writes each page as `<route>/index.html`, and Cargo
// serves a path from the file exported for it, so `/about` and `/about/` both
// serve the about page and a missing page gets `404.html` with status 404.
//
// The package has its own package.json and lockfile, which is also what stops
// the CDK loader from importing its browser code as resources.
//
// `path` is relative to the directory the CDK runs in, and the CDK hashes the
// string itself: an absolute path would read as a change on every machine and
// in CI. It is computed from this file so it stays right wherever
// `cargo-ai cdk add` placed the folder (`infra/website-building/apps/website`
// in a project, `infra/apps/website` here). Keep the computation.
const path = relative(
  process.cwd(),
  fileURLToPath(new URL("./website", import.meta.url)),
)
  .split(sep)
  .join("/");

export const website = defineApp("website", {
  name: "Website", // PLACEHOLDER: the company's name for it
  description: "The public company website, built from reviewed source.",
  path,
  folder: appsFolder,
  // PLACEHOLDER: the hostname the site is served on. Always a subdomain
  // (`www.`): the apex cannot CNAME to an app, so `../domains/website.ts`
  // forwards it here. Declaring a hostname attaches it on deploy, but nothing is
  // served on it until its `_cargo-verify` TXT record resolves. Removing a
  // hostname later leaves it attached: a deploy never takes a live site off its
  // name. Detach it in Cargo on purpose.
  domains: ["www.example.com"],
  // No `env`: app variables are compiled into a public bundle. No Cargo SDK,
  // login or private context belongs in this app.
});
