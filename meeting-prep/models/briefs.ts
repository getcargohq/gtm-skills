import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders/gtm";

// The dedupe ledger: one row per meeting the agent has already briefed.
//
// WHY THIS EXISTS. The original design (from the Discovery Call Briefer running
// in production) deduped by reading the Slack channel back and looking for a
// marker per meeting id. That is not possible here: the Slack integration in
// Cargo exposes exactly one action, `postMessage`. There is no read-history
// action, so a Slack-history dedupe cannot be built.
//
// This ledger is the replacement, and it is the better mechanism anyway. Reading
// a chat channel to find out what you have done is a workaround for not having
// state. This is state: it survives a channel rename, an archived message, and
// someone deleting the card. The agent checks it before posting and appends to it
// after, so re-running the agent on the same day posts nothing new.
export const meetingBriefs = defineModel("meeting_briefs", {
  kind: "native",
  extractSlug: "defineCustom",
  config: {
    columns: [
      { slug: "meeting_id", type: "string" },
      { slug: "briefed_at", type: "date" },
      { slug: "meeting_title", type: "string" },
      { slug: "company", type: "string" },
    ],
  },
  folder: modelsFolder,
});
