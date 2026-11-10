import { defineFolder } from "@cargo-ai/cdk";

// One folder per pipeline, so "what put this agent here, and what came with
// it" is answered by looking, and removing the pipeline is a bounded job.
export const agentsFolder = defineFolder("meeting_prep_agents", {
  kind: "agent",
  name: "Meeting prep",
});

export const modelsFolder = defineFolder("meeting_prep_models", {
  kind: "model",
  name: "Meeting prep",
});
