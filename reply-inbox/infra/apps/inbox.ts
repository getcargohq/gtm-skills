import { defineApp } from "@cargo-ai/cdk";

import { appsFolder } from "../folders";

// The inbox as a hosted Cargo app: the reconciler uploads the Vite bundle,
// the backend builds and promotes it, and the live URL lands on `inbox.url`.
//
// PLACEHOLDER — `--slug` is the live subdomain and must be globally unique
// within the hosting domain. `reply-inbox` is the checked example; change it
// if `plan` reports a collision.
//
// A hosted app is a recurring monthly credit charge for as long as it exists.
// Quote the live figure before applying a `+ create app:…` line. `destroy` is
// the only way it stops.
export const inbox = defineApp("reply-inbox", {
  path: new URL("./inbox", import.meta.url).pathname,
  name: "Reply inbox",
  description:
    "Mailbox reply queue and LinkedIn send, as a hosted app the team can live in.",
  folder: appsFolder,
});
