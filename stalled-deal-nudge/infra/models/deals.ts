import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// The open pipeline, as a Cargo native deal model: no connector, no key, so
// this example deploys in an empty workspace. The `defineDeal` extractor gives
// the standard deal schema (id, name, account_id, amount, stage_name,
// close_date, probability, next_step, is_closed, is_won, owner_id, ...).
//
// Nothing here decides what "stalled" means. That is a question, and it is
// asked in the agent's SQL in `../agents/nudger.prompt.ts`.
//
// Deals live in a CRM? Swap this for a connector-backed model that extracts
// every deal and every column (`fetchRecords`, `columnSelectionMode: "all"`)
// and adapt the column names in the prompt's SQL. SKILL.md, `crm-backed`.
export const deals = defineModel("deals", {
  kind: "native",
  extractSlug: "defineDeal",
  folder: modelsFolder,
});
