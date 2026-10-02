import { defineModel } from "@cargo-ai/cdk";

import { crm } from "../connectors/crm";
import { modelsFolder } from "../folders";

// PLACEHOLDER: the deal property that carries the lost reason. HubSpot's
// standard one is `closed_lost_reason`; many portals record it on a custom
// property instead, and the audit's fill rate then reads 0 of N. Set it from
// the live deal schema, here and in LOST_REASON_COLUMN in the agent's prompt.
const lostReasonProperty = "closed_lost_reason";

// Every closed deal, won or lost: the one thing the audit reads that the other
// CRM cookbooks do not already model. Extraction bills no credits, and the
// agent reads it with SQL as `crm.crm_deals`.
//
// Only the properties the audit reads, picked by name. `amount` is
// deliberately not among them: the audit never needs it, and what is not
// extracted cannot leak into context/, which every agent reads, including the
// ones that talk to prospects.
//
// `hs_primary_associated_company` joins a deal to `crm_accounts`, and titles
// are read at the won accounts through `crm_contacts.associatedcompanyid`.
// Titles on the deal itself (its associated contacts) are the `deal_contacts`
// variation: add `associationObjectTypes: ["contacts"]` here and read the
// column it creates after the first sync.
export const crmDeals = defineModel("crm_deals", {
  folder: modelsFolder,
  connector: crm,
  extractSlug: "fetchRecords",
  config: {
    objectType: "deals",
    filter: {
      conjonction: "and",
      groups: [
        {
          conjonction: "and",
          conditions: [
            { propertyName: "hs_is_closed", operator: "is", values: ["true"] },
          ],
        },
      ],
    },
    columnSelectionMode: "pick",
    selectedPropertiesNames: [
      "dealname",
      "pipeline",
      "dealstage",
      "dealtype",
      "closedate",
      "hs_is_closed_won",
      "hs_is_closed_lost",
      "num_associated_contacts",
      "hs_primary_associated_company",
      lostReasonProperty,
    ],
  },
  // Daily: the agent runs monthly, and a deal closed today is read next month
  // either way. Hourly would only re-read the same closed deals.
  schedule: { type: "cron", cron: "0 5 * * *" },
});
