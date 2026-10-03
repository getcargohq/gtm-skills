import { defineModel } from "@cargo-ai/cdk";

import { hubspot } from "../connectors/hubspot";
import { modelsFolder } from "../folders";

// Every HubSpot deal, every column: the purchase history the analyst reads to
// judge cadence (two or more won deals at a regular interval) and the last
// price paid. Read-only for the agent; nothing in this pipeline writes a deal.
export const crmDeals = defineModel("crm_deals", {
  folder: modelsFolder,
  connector: hubspot,
  extractSlug: "fetchRecords",
  config: { objectType: "deals", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 * * * *" },
});
