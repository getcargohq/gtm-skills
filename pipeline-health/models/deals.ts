import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../../base-gtm/folders/gtm";

// The open pipeline. NATIVE (`defineDeal`), so it deploys with no CRM
// credential and its columns are typed: id, name, account_id, amount,
// stage_name, close_date, probability, type, lead_source, next_step,
// forecast_category, is_closed, is_won, expected_revenue, owner_id.
//
// To mirror your CRM's deals instead, install `crm-sync` and swap this for a
// connector-backed model:
//
//   import { hubspot } from "../../crm-sync/connectors/hubspot";
//
//   export const deals = defineModel("deals", {
//     connector: hubspot,
//     extractSlug: "fetchRecords",
//     config: { objectType: "deals", columnSelectionMode: "all" },
//     schedule: { type: "cron", cron: "0 * * * *" },
//     folder: modelsFolder,
//   });
//
// (Salesforce: objectType "Opportunity".) Note the tradeoff: a connector-backed
// model's columns are not statically typed, so `deals.columns.<slug>` stops
// being checked. The rules below name columns explicitly, so if you swap, check
// each one against your CRM's property names.
//
// The two custom columns are what the analyst writes back: the risk verdict and
// when it last ran. They are what makes the digest auditable rather than
// ephemeral chat output.
export const deals = defineModel("deals", {
  kind: "native",
  extractSlug: "defineDeal",
  folder: modelsFolder,
  additionalColumns: [
    {
      kind: "custom",
      slug: "risk_reason",
      type: "string",
      label: "Risk reason",
      description:
        "Which rule fired and the suggested action. Written by the pipeline-health agent.",
    },
    {
      kind: "custom",
      slug: "risk_checked_at",
      type: "date",
      label: "Risk checked at",
      description: "When the analyst last evaluated this deal.",
    },
  ],
});
