import { defineFolder } from "@cargo-ai/cdk";

// Every resource this skill deploys is filed under folders named after the
// skill. A workspace accumulates resources from several skills plus whatever
// the team wrote by hand, and the folder is what answers "what put this here,
// and what else came with it" by looking. It is also what makes removing a
// skill bounded rather than a hunt.
//
// Folders are per-kind: this skill files a model, two agents, a play and a
// mailbox. Domains have no folder kind.
export const modelsFolder = defineFolder("reply_handling_models", {
  kind: "model",
  name: "Reply handling",
});

export const agentsFolder = defineFolder("reply_handling_agents", {
  kind: "agent",
  name: "Reply handling",
});

export const playsFolder = defineFolder("reply_handling_plays", {
  kind: "play",
  name: "Reply handling",
});

export const mailboxesFolder = defineFolder("reply_handling_mailboxes", {
  kind: "mailbox",
  name: "Reply handling",
});
