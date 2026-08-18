import { defineFile } from "@cargo-ai/cdk";

// A knowledge file resource (RAG source), distinct from the context repo:
// context files are traversed whole; file resources are chunked and retrieved.
// Content is read + hashed at define time, so editing the .md shows as drift.
export const gtmPlaybook = defineFile("gtm-playbook", {
  path: new URL("./gtm-playbook.md", import.meta.url).pathname,
  name: "GTM Playbook",
});
