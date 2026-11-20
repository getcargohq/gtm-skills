/// <reference types="node" />
import { defineApp } from "@cargo-ai/cdk";
import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { appsFolder } from "../folders";
// Imported so the board never deploys without the rows it reads.
import "../models/post-engagement";

// Everyone who engaged with the tracked profiles' posts, scored per person and
// per account, read live from the Cargo Signals models every time it opens.
// Viewers sign in with their Cargo login and the board queries storage as them,
// so it holds no token and no data of its own: nobody outside the workspace can
// open it.
//
// `path` is relative to the directory `cargo-ai project` runs in, and the
// deploy hashes the string itself: an absolute path would read as a change on
// every machine and in CI. It is computed from this file so it stays right
// wherever `cargo-ai project add` placed the folder. Keep the computation.
const path = relative(
  process.cwd(),
  fileURLToPath(new URL("./engagement-board", import.meta.url)),
)
  .split(sep)
  .join("/");

export const engagementBoard = defineApp("engagement-board", {
  name: "Engagement Board",
  description:
    "Who engages with our LinkedIn posts: people, accounts and posts, scored.",
  path,
  folder: appsFolder,
});
