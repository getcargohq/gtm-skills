import { defineFolder } from "@cargo-ai/cdk";

// Folders are per-kind — one for models, one for agents. Every skill files
// its resources under these.
export const modelsFolder = defineFolder("gtm-models", {
  kind: "model",
  name: "GTM",
});

export const agentsFolder = defineFolder("gtm-agents", {
  kind: "agent",
  name: "GTM",
});
