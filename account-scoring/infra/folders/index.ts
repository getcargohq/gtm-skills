import { defineFolder } from "@cargo-ai/cdk";

// Every resource this skill deploys is filed under folders named after the
// skill, not under shared "GTM" ones. A workspace accumulates resources from
// several skills plus whatever the team wrote by hand, and the folder is what
// answers "what put this here, and what else came with it" by looking. It is
// also what makes removing a skill bounded rather than a hunt.
//
// Folders are per-kind, which is why there are two rather than one.
export const modelsFolder = defineFolder("account_scoring_models", {
  kind: "model",
  name: "Account scoring",
});

export const agentsFolder = defineFolder("account_scoring_agents", {
  kind: "agent",
  name: "Account scoring",
});
