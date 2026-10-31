/// <reference types="node" />
import { defineApp } from "@cargo-ai/cdk";
import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { appsFolder } from "../folders";
import { cockpitClaims } from "../models/cockpit-claims";
import { cockpitDrafts } from "../models/cockpit-drafts";
import { gtmActivities } from "../models/gtm-activities";
import { claimAccount } from "../tools/claim-account";
import { enrichContact } from "../tools/enrich-contact";
import { redraft } from "../tools/redraft";
import { sendDraft } from "../tools/send-draft";

// The cockpit: the Vite app in `./cockpit/`, behind the Cargo login. Cargo
// uploads the directory and builds it on deploy; the live URL is `cockpit.url`.
//
// The ids the app calls reach the bundle through `env`, as deploy-time tokens,
// so the source carries no workspace ids and the same code deploys anywhere.
// They are uuids, not secrets: app variables are compiled into a bundle every
// signed-in member can read.
//
// `path` is relative to the directory `cargo-ai project` runs in, and the
// deploy hashes the string itself: an absolute path would read as a change on
// every machine. It is computed from this file so it stays right wherever
// `cargo-ai project add` placed the folder.
const path = relative(
  process.cwd(),
  fileURLToPath(new URL("./cockpit", import.meta.url)),
)
  .split(sep)
  .join("/");

export const cockpit = defineApp("rep-cockpit", {
  name: "Rep cockpit",
  description:
    "Hot leads to claim, the buying committee sourced on claim, and a first-touch email per person to review and send from the rep's mailbox.",
  path,
  folder: appsFolder,
  env: {
    VITE_CLAIM_TOOL_UUID: claimAccount.uuid,
    VITE_SEND_TOOL_UUID: sendDraft.uuid,
    VITE_REDRAFT_TOOL_UUID: redraft.uuid,
    VITE_ENRICH_TOOL_UUID: enrichContact.uuid,
    VITE_CLAIMS_MODEL_UUID: cockpitClaims.uuid,
    VITE_DRAFTS_MODEL_UUID: cockpitDrafts.uuid,
    VITE_ACTIVITIES_MODEL_UUID: gtmActivities.uuid,
  },
});
