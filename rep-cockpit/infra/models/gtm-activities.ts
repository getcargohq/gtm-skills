import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// Logged activity: one row per meeting, call, email, note or task. The send
// tool writes one `email` row per message a rep sends from the cockpit, so
// every other pipeline that reads activity (meeting-prep, next-step-tracker,
// readiness-scoring's first-party events) sees the touch.
//
// `gtm_activities` is a shared native model: every pipeline that reads
// activity declares it with this exact slug and these columns
// (scripts/native-models.json), so a project that installs several keeps one.
export const gtmActivities = defineModel("gtm_activities", {
  name: "GTM activities",
  kind: "native",
  extractSlug: "defineCustom",
  config: {
    columns: [
      // gtm_accounts.id
      { slug: "account_id", type: "string" },
      // gtm_opportunities.id, or empty when not tied to one.
      { slug: "opportunity_id", type: "string" },
      // gtm_contacts.id, or empty when not tied to one.
      { slug: "contact_id", type: "string" },
      { slug: "occurred_at", type: "date" },
      // meeting | call | email | note | task
      { slug: "kind", type: "string" },
      { slug: "subject", type: "string" },
      { slug: "body", type: "string" },
      // Who on our side did it.
      { slug: "owner_email", type: "string" },
    ],
  },
  folder: modelsFolder,
});
