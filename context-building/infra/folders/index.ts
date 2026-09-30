import { defineFolder } from "@cargo-ai/cdk";

// Every resource this cookbook deploys is filed under a folder named after the
// cookbook, not under a shared "GTM" one.
//
// The reason is provenance. A workspace accumulates resources from several
// cookbooks plus whatever the team wrote by hand, and six months later the
// only question that matters about an agent nobody recognises is "what put
// this here, and what else came with it". A folder per cookbook answers that
// by looking; a shared folder makes it an archaeology exercise across the
// repo. It is also what makes removing a cookbook a bounded operation rather
// than a hunt.
//
// Folders are per-kind. Only the agent folder is declared, because only agents
// deploy by default: the persona job models are opt-in (see
// ../models/persona-jobs.ts), and a folder nothing is filed into is a resource
// that deploys, shows up in the workspace and rots. Add
// `defineFolder("context-building-models", { kind: "model", name: "Context
// building" })` here the day the first standing model is declared.
export const agentsFolder = defineFolder("context-building-agents", {
  kind: "agent",
  name: "Context building",
});
