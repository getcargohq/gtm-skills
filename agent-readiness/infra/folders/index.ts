import { defineFolder } from "@cargo-ai/cdk";

// One folder per pipeline, so "what put this agent here, and what came with
// it" is answered by looking, and removing the pipeline is a bounded job.
export const agentsFolder = defineFolder("agent_readiness_agents", {
  kind: "agent",
  name: "Agent readiness",
});

export const modelsFolder = defineFolder("agent_readiness_models", {
  kind: "model",
  name: "Agent readiness",
});
