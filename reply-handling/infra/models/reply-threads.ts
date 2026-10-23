import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// One row per person in the loop, keyed by email. Adding a row is what sends
// the first touch: the play runs on rows ADDED here, so a row is a real email
// to a real person, and nobody is added "to test something". The pilot adds
// the operator's own address (references/run.md).
//
// The row is also the ledger. Every stage writes its result back onto it, so
// where each conversation stands is one query: `waiting` (first touch sent),
// `first_touch_blocked` (the draft failed the gate, nothing sent),
// `suppressed`, `pending_review`, `approved` (clicked, queued for the next
// send slot), `replied`, `auto_replied` or `declined`.
//
// To run someone through again, remove the row and add it back: an update to
// an existing row starts nothing.
//
// Times are ISO 8601 strings, written by the play.
export const replyThreads = defineModel("reply_threads", {
  kind: "native",
  extractSlug: "defineCustom",
  name: "Reply threads",
  description:
    "People in the reply loop. Adding a row sends the first touch from the mailbox; the same row carries the reply, its class, the draft, the review decision and the sent answer.",
  folder: modelsFolder,
  config: {
    columns: [
      { slug: "email", type: "string" },
      { slug: "first_name", type: "string" },
      { slug: "last_name", type: "string" },
      { slug: "company", type: "string" },
      { slug: "title", type: "string" },
      { slug: "fact", type: "string" },
      { slug: "status", type: "string" },
      { slug: "updated_at", type: "string" },
      { slug: "touch_subject", type: "string" },
      { slug: "touch_body", type: "string" },
      { slug: "touch_message_uuid", type: "string" },
      { slug: "touch_rfc_id", type: "string" },
      { slug: "sent_at", type: "string" },
      { slug: "thread_uuid", type: "string" },
      { slug: "reply_at", type: "string" },
      { slug: "reply_from", type: "string" },
      { slug: "reply_snippet", type: "string" },
      { slug: "reply_rfc_id", type: "string" },
      { slug: "reply_class", type: "string" },
      { slug: "confidence", type: "number" },
      { slug: "positivity", type: "number" },
      { slug: "routing", type: "string" },
      { slug: "routing_reason", type: "string" },
      { slug: "slots", type: "string" },
      { slug: "draft_body", type: "string" },
      { slug: "gate_flags", type: "string" },
      { slug: "review_decision", type: "string" },
      { slug: "reviewer", type: "string" },
      { slug: "final_body", type: "string" },
      { slug: "reply_message_uuid", type: "string" },
      { slug: "replied_at", type: "string" },
    ],
  },
});
