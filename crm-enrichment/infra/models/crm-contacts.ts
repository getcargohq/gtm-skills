import { defineModel } from "@cargo-ai/cdk";

import { crm } from "../connectors/crm";
import { modelsFolder } from "../folders/crm-enrichment";

// The contact universe comes directly from the CRM so every play row carries
// the CRM record ID used by the write action.
export const crmContacts = defineModel("crm_contacts", {
  folder: modelsFolder,
  connector: crm,
  extractSlug: "fetchRecords",
  config: { objectType: "contacts", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 * * * *" },
});
