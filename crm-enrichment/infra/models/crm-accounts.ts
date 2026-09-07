import { defineModel } from "@cargo-ai/cdk";

import { crm } from "../connectors/crm";
import { modelsFolder } from "../folders/crm-enrichment";

// The account universe, extracted from the CRM itself. The play runs on this
// model so every enrolled row carries the CRM's own record ID — the identifier
// `updateRecords` matches on. A native model would introduce a second identity
// system, and a write targeting the wrong one looks successful while nothing
// lands.
export const crmAccounts = defineModel("crm_accounts", {
  folder: modelsFolder,
  connector: crm,
  extractSlug: "fetchRecords",
  config: { objectType: "companies", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 * * * *" },
});
