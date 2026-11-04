import { defineFolder } from "@cargo-ai/cdk";

// Filed under a folder named after the pipeline, not a shared one, so "what put
// this agent here" is answered by looking, and removing the pipeline is bounded.
export const agentsFolder = defineFolder("pull_request_agent_agents", {
  kind: "agent",
  name: "Pull request agent",
});
