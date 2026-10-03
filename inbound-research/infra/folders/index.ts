import { defineFolder } from "@cargo-ai/cdk";

// One folder per pipeline, so "what put this here, and what came with it" is
// answered by looking, and removing the pipeline is a bounded job.
export const modelsFolder = defineFolder("inbound_research_models", {
  kind: "model",
  name: "Inbound research",
});

export const agentsFolder = defineFolder("inbound_research_agents", {
  kind: "agent",
  name: "Inbound research",
});

export const playsFolder = defineFolder("inbound_research_plays", {
  kind: "play",
  name: "Inbound research",
});
