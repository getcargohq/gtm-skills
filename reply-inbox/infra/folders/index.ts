import { defineFolder } from "@cargo-ai/cdk";

// Folders are per-kind. This skill deploys one hosted app, so it files that
// app under a folder named after the skill. A workspace accumulates apps from
// several skills plus whatever the team wrote by hand, and the folder is what
// answers "what put this here" by looking.
export const appsFolder = defineFolder("reply-inbox-apps", {
  kind: "app",
  name: "Reply inbox",
});
