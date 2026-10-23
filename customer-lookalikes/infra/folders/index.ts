import { defineFolder } from "@cargo-ai/cdk";

// Every resource this skill deploys is filed under folders named after the
// skill. A workspace accumulates resources from several skills plus whatever
// the team wrote by hand, and the folder is what answers "what put this here,
// and what else came with it" by looking. It is also what makes removing a
// skill bounded rather than a hunt.
//
// Folders are per-kind: this skill files two models, four agents and a play.
export const modelsFolder = defineFolder("customer_lookalikes_models", {
  kind: "model",
  name: "Customer lookalikes",
});

export const agentsFolder = defineFolder("customer_lookalikes_agents", {
  kind: "agent",
  name: "Customer lookalikes",
});

export const playsFolder = defineFolder("customer_lookalikes_plays", {
  kind: "play",
  name: "Customer lookalikes",
});
