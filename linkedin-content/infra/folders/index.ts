import { defineFolder } from "@cargo-ai/cdk";

// One folder per pipeline, so "what put this agent here, and what came with
// it" is answered by looking, and removing the pipeline is a bounded job.
// This pipeline deploys one agent, so one folder.
export const agentsFolder = defineFolder("linkedin_content_agents", {
  kind: "agent",
  name: "LinkedIn content",
});
