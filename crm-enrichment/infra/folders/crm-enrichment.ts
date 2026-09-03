import { defineFolder } from "@cargo-ai/cdk";

// Every resource this skill deploys is filed under folders named after the
// skill. A workspace accumulates resources from several skills plus whatever
// the team wrote by hand, and the folder is what answers "what put this here,
// and what else came with it" by looking. It is also what makes removing a
// skill bounded rather than a hunt.
//
// Folders are per-kind, which is why there are three: this skill deploys a
// model, a tool and a play, and each kind is filed separately.
export const modelsFolder = defineFolder("crm-enrichment-models", {
  kind: "model",
  name: "CRM enrichment",
});

export const toolsFolder = defineFolder("crm-enrichment-tools", {
  kind: "tool",
  name: "CRM enrichment",
});

export const playsFolder = defineFolder("crm-enrichment-plays", {
  kind: "play",
  name: "CRM enrichment",
});
