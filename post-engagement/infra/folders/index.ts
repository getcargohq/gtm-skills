import { defineFolder } from "@cargo-ai/cdk";

// Every resource this skill deploys is filed under a folder named after it, so
// "what put this here, and what came with it" is answered by looking, and
// removing the skill is a bounded job. Folders are per-kind.
export const modelsFolder = defineFolder("post_engagement_models", {
  kind: "model",
  name: "Post engagement",
});

export const appsFolder = defineFolder("post_engagement_apps", {
  kind: "app",
  name: "Post engagement",
});
