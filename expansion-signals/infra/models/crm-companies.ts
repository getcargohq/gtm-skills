import { defineModel } from "@cargo-ai/cdk";

import { hubspot } from "../connectors/hubspot";
import { modelsFolder } from "../folders";

// Every HubSpot company, every column. The play runs on this model so each
// enrolled row carries `hs_object_id`, the identifier `updateRecords` matches
// on: a native model in between would be a second identity system, and a
// write aimed at the wrong one reports success while nothing lands.
//
// No filter and no column pick in `config`. Which companies are customers in
// their renewal window is asked in the play's filter, where it can be read and
// changed without a re-extraction. HubSpot's own roll-ups
// (`lifecyclestage`, `recent_deal_close_date`, `recent_deal_amount`,
// `num_associated_deals`) and the three `cargo_expansion_*` properties the play
// writes all arrive through this sync.
export const crmCompanies = defineModel("crm_companies", {
  folder: modelsFolder,
  connector: hubspot,
  extractSlug: "fetchRecords",
  config: { objectType: "companies", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 * * * *" },
});
