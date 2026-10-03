import { defineModel } from "@cargo-ai/cdk";

import { hubspot } from "../connectors/hubspot";
import { modelsFolder } from "../folders";

// Every deal in the CRM, every column. Nothing is filtered here.
//
// "Open and quiet for N days" is a question, and a question belongs in the
// query that asks it: the agent's SQL in `../agents/nudger.prompt.ts`. A
// filter in this config would be a second place the question is asked,
// invisible to anyone reading the query, and changing N would mean a redeploy
// and a re-extraction instead of an edited line.
//
// Synced every morning, ahead of the Monday run, so "last activity" is at
// most a day old when the digest is written. A stalled deal is stalled on the
// scale of weeks; a fresher sync buys nothing.
export const crmDeals = defineModel("crm_deals", {
  connector: hubspot,
  extractSlug: "fetchRecords",
  config: { objectType: "deals", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 12 * * *" },
  folder: modelsFolder,
});
