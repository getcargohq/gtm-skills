import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// The open deal behind a meeting, if any. A Cargo native deal model
// (`defineDeal`: id, name, account_id, amount, stage_name, close_date,
// next_step, is_closed, owner_id, ...). Read only: a pre-call brief never
// moves a stage.
//
// `gtm_opportunities` is a shared native model (scripts/native-models.json):
// every pipeline that needs opportunities declares it under this slug, so a
// project that installs several keeps one.
export const gtmOpportunities = defineModel("gtm_opportunities", {
  name: "GTM opportunities",
  kind: "native",
  extractSlug: "defineDeal",
  folder: modelsFolder,
});
