import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// Logged activity: one row per meeting, call, email, note or task, against an
// account and, when there is one, a deal. Read-only for every agent that uses
// it.
//
// The same slug and columns ship in every pipeline that reads activity
// (meeting-prep, next-step-tracker, stalled-deal-nudge), so a project that
// installs several keeps one model: rewire the imports to the first copy and
// drop the others. Change a column here and change it in all of them.
//
// A native custom model, so the worked example deploys with no CRM. Whatever
// logs your activity fills it: call-capture's scribe, a sequencer or recorder
// webhook, a play, a CSV, or `cargo-ai storage record create-bulk`. On a CRM,
// swap it for a connector-backed model of the CRM's engagements and map their
// columns onto these (`crm-backed` in SKILL.md).
export const activities = defineModel("activities", {
  kind: "native",
  extractSlug: "defineCustom",
  config: {
    columns: [
      // companies.id
      { slug: "account_id", type: "string" },
      // deals.id, or empty when the activity is not tied to a deal.
      { slug: "deal_id", type: "string" },
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
