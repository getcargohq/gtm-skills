import { defineModel } from "@cargo-ai/cdk";
import { hubspot } from "../connectors/hubspot";
import { modelsFolder } from "../folders";

// Run on the actual CRM extract. Reconcile this model with the customer project.
// No schedule until the source scope, mappings and recurring cost are approved.
export const accounts = defineModel("accounts", {
  connector: hubspot,
  extractSlug: "fetchRecords",
  config: { objectType: "companies", columnSelectionMode: "all" },
  folder: modelsFolder,
  additionalColumns: [
    {
      kind: "custom",
      slug: "fit_last_scored_snapshot",
      type: "string",
      label: "Last verified score snapshot",
    },
    {
      kind: "custom",
      slug: "fit_last_scored_result",
      type: "string",
      label: "Last verified Python result",
    },
    {
      kind: "custom",
      slug: "fit_evidence",
      type: "string",
      label: "Approved feature evidence",
      description:
        "Cached account_id, feature_contract_version and per-feature provenance JSON from approved extraction routes.",
    },
    {
      kind: "custom",
      slug: "fit_snapshot",
      type: "string",
      label: "Normalized fit snapshot",
    },
    {
      kind: "custom",
      slug: "fit_result",
      type: "string",
      label: "Trusted Python result",
    },
    {
      kind: "custom",
      slug: "fit_status",
      type: "string",
      label: "Latest scoring attempt status",
    },
    {
      kind: "custom",
      slug: "fit_scoring_version",
      type: "string",
      label: "Successfully written scoring version",
    },
    {
      kind: "custom",
      slug: "fit_scored_at",
      type: "date",
      label: "Verified CRM write timestamp",
    },
  ],
});
