import { defineFolder } from "@cargo-ai/cdk";

// Every resource this cookbook deploys is filed under a folder named after the
// cookbook, not under a shared "GTM" one. That is provenance: six months later
// the question about an agent nobody recognises is "what put this here", and a
// folder per cookbook answers it by looking.
export const agentsFolder = defineFolder("workspace_health_agents", {
  kind: "agent",
  name: "Workspace health",
});
