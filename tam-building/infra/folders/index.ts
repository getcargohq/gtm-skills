import { defineFolder } from "@cargo-ai/cdk";

// Every resource this skill deploys is filed under folders named after the
// skill, not under a shared "GTM" one. A workspace accumulates resources from
// several skills plus whatever the team wrote by hand, and the folder is what
// answers "what put this here, and what else came with it" by looking. It is
// also what makes removing a skill bounded rather than a hunt.
//
// One folder, because this skill deploys one kind of resource: models. The
// unified accounts model is adopted rather than created and takes no folder.
export const modelsFolder = defineFolder("tam-building-models", {
  kind: "model",
  name: "TAM building",
});
