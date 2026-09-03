import { defineFolder } from "@cargo-ai/cdk";

// Every resource this skill deploys is filed under a folder named after the
// skill, not under a shared "GTM" one. A workspace accumulates resources from
// several skills plus whatever the team wrote by hand, and the folder is what
// answers "what put this here, and what else came with it" by looking. It is
// also what makes removing a skill bounded rather than a hunt.
//
// Folders are per-kind. This skill deploys models and nothing else, so there is
// one; a skill that also deployed agents would declare `tam-building-agents`
// beside it, carrying the same display name.
export const modelsFolder = defineFolder("tam-building-models", {
  kind: "model",
  name: "TAM building",
});
