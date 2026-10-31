import { defineFolder } from "@cargo-ai/cdk";

// Every resource this skill deploys is filed under folders named after the
// skill, so "what put this here, and what else came with it" is answered by
// looking, and removing the skill is bounded rather than a hunt.
//
// Folders are per-kind. Domains and members have no folder kind.
export const modelsFolder = defineFolder("rep_cockpit_models", {
  kind: "model",
  name: "Rep cockpit",
});

export const toolsFolder = defineFolder("rep_cockpit_tools", {
  kind: "tool",
  name: "Rep cockpit",
});

export const agentsFolder = defineFolder("rep_cockpit_agents", {
  kind: "agent",
  name: "Rep cockpit",
});

export const mailboxesFolder = defineFolder("rep_cockpit_mailboxes", {
  kind: "mailbox",
  name: "Rep cockpit",
});

export const appsFolder = defineFolder("rep_cockpit_apps", {
  kind: "app",
  name: "Rep cockpit",
});
