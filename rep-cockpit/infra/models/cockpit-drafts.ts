import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// One first-touch email per sourced person, keyed by the gtm_contacts id. The
// claim tool writes the draft; the send tool marks it sent with the message it
// started. The cockpit reads this one table to render an account, so the
// person's name, title and email are copied onto the row.
//
// `status`: draft (ready to review), no_email (the lookup found none, so
// there is nothing to send to), sent.
export const cockpitDrafts = defineModel("cockpit_drafts", {
  name: "Cockpit drafts",
  kind: "native",
  extractSlug: "defineCustom",
  config: {
    columns: [
      // gtm_contacts.id
      { slug: "contact_id", type: "string" },
      { slug: "account_domain", type: "string" },
      { slug: "rep_email", type: "string" },
      { slug: "contact_name", type: "string" },
      { slug: "contact_title", type: "string" },
      { slug: "contact_email", type: "string" },
      { slug: "linkedin_url", type: "string" },
      { slug: "subject", type: "string" },
      { slug: "body", type: "string" },
      { slug: "why_now", type: "string" },
      { slug: "status", type: "string" },
      { slug: "drafted_at", type: "date" },
      { slug: "sent_at", type: "date" },
      { slug: "message_uuid", type: "string" },
    ],
  },
  folder: modelsFolder,
});
