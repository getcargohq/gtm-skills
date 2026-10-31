import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// One row per sourced person, keyed by the gtm_contacts id: the email the rep
// sends next, and where the thread stands. The claim tool writes the first
// draft; the send tool marks it sent; the watch play logs the reply or drafts
// the follow-up on the same row. The cockpit reads this one table to render an
// account, so the person and the claim's names are copied onto the row.
//
// `status`:
//   draft          ready to review
//   no_email       the lookup found no address; Find email retries it
//   sent           sent, the play is waiting for a reply
//   follow_up      no reply in time: the next touch is drafted, in the thread
//   replied        a reply landed: `reply_snippet`, `replied_at`
//   no_reply       the last touch got no reply
//   meeting_booked the rep booked a meeting from the reply
//
// LinkedIn runs beside the email on the same row: `linkedin_note` is the
// writer's connection note, `linkedin_status` invited or messaged once the
// rep sends it. LinkedIn replies are not watched: they are in the rep's inbox.
export const cockpitDrafts = defineModel("cockpit_drafts", {
  name: "Cockpit drafts",
  kind: "native",
  extractSlug: "defineCustom",
  config: {
    columns: [
      // gtm_contacts.id
      { slug: "contact_id", type: "string" },
      { slug: "account_domain", type: "string" },
      // gtm_accounts.id, for the activity rows the play writes.
      { slug: "account_id", type: "string" },
      { slug: "account_name", type: "string" },
      { slug: "rep_email", type: "string" },
      // The name the writer signs with.
      { slug: "rep_name", type: "string" },
      { slug: "contact_name", type: "string" },
      { slug: "contact_title", type: "string" },
      { slug: "contact_email", type: "string" },
      { slug: "contact_phone", type: "string" },
      { slug: "linkedin_url", type: "string" },
      { slug: "subject", type: "string" },
      { slug: "body", type: "string" },
      { slug: "why_now", type: "string" },
      { slug: "linkedin_note", type: "string" },
      // invited | messaged
      { slug: "linkedin_status", type: "string" },
      { slug: "linkedin_sent_at", type: "date" },
      { slug: "status", type: "string" },
      { slug: "drafted_at", type: "date" },
      { slug: "sent_at", type: "date" },
      // The last message sent: the play waits on its thread, and a follow-up
      // replies to its Message-ID so it lands in the same thread.
      { slug: "message_uuid", type: "string" },
      { slug: "rfc_message_id", type: "string" },
      // Emails sent to this person so far.
      { slug: "touches", type: "number" },
      { slug: "reply_snippet", type: "string" },
      { slug: "replied_at", type: "date" },
    ],
  },
  folder: modelsFolder,
});
