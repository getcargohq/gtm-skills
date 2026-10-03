import { defineModel } from "@cargo-ai/cdk";

import { hubspot } from "../connectors/hubspot";
import { modelsFolder } from "../folders";

// Every HubSpot contact, every column. The play narrows to new inbound in its
// own filter, where the question is visible to anyone reading it; a filter in
// this config would be a second place it is asked, and changing it would mean
// a redeploy and a re-extraction instead of an edited filter.
//
// Extracted from the CRM, so every row carries `hs_object_id`, the id the play
// writes back to. Nothing sits between this model and the write.
//
// Every 30 minutes, HubSpot's floor for an incremental fetch: a demo request
// is researched within the hour, not the next morning.
export const crmContacts = defineModel("inbound_crm_contacts", {
  folder: modelsFolder,
  connector: hubspot,
  extractSlug: "fetchRecords",
  config: { objectType: "contacts", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "*/30 * * * *" },
});
