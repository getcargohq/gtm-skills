import { defineFolder } from "@cargo-ai/cdk";

// Every resource this skill deploys is filed under folders named after the
// skill. A workspace accumulates resources from several skills plus whatever
// the team wrote by hand, and the folder is what answers "what put this here,
// and what else came with it" by looking.
//
// Folders are per-kind: one tool, and the two shared models when this is the
// first pipeline in the project to declare them.
export const toolsFolder = defineFolder("inbound_qualification_tools", {
  kind: "tool",
  name: "Inbound qualification",
});

export const modelsFolder = defineFolder("inbound_qualification_models", {
  kind: "model",
  name: "Inbound qualification",
});
