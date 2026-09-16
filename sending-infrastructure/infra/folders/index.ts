import { defineFolder } from "@cargo-ai/cdk";

// Every resource this skill deploys is filed under folders named after the
// skill, so a workspace that accumulates fleets from several campaigns can
// still answer "what put this here, and what else came with it" by looking.
//
// Folders are per-kind. This skill deploys mailboxes and nothing else that is
// foldered: domains are workspace-level and carry no folder.
export const mailboxesFolder = defineFolder(
  "sending-infrastructure-mailboxes",
  {
    kind: "mailbox",
    name: "Sending infrastructure",
  },
);
