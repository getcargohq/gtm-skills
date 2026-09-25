import { defineModel } from "@cargo-ai/cdk";

import { crm } from "../connectors/crm";
import { modelsFolder } from "../folders";

// The CRM's companies, extracted so they join the same unified accounts as the
// sourced ones. This model is read-only here: the skill never writes to the
// CRM, it only needs to know what is already in it.
//
// Most projects already declare this model (crm-enrichment ships the same slug
// on the same connector). When one exists, import it and drop this file: two
// resources with one slug collide at deploy, and two extracts of the same CRM
// object would each unify, so every CRM company would count twice.
//
// HubSpot's own mapping keys a company on `website` (domain) and its LinkedIn
// fields. Its `name` also maps to the slug reference, which the unified model
// leaves at "none" by default: two companies that share a name are not merged.
export const crmAccounts = defineModel("crm_accounts", {
  folder: modelsFolder,
  connector: crm,
  extractSlug: "fetchRecords",
  // PLACEHOLDER: HubSpot's companies object. Salesforce and Attio name their
  // account object differently. All columns, because the integration's
  // unification mapping reads several of them (website, LinkedIn URL, handle).
  config: { objectType: "companies", columnSelectionMode: "all" },
  unification: { source: "integration" },
  // Twice a day, the unified model's own default cadence: a fresher CRM extract
  // would sit unread until the next merge. The run procedure syncs it once more
  // right before the report, so the report never reads a stale CRM.
  schedule: { type: "cron", cron: "0 */12 * * *" },
});
