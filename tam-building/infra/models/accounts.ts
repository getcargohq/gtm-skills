import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders/tam-building";

// The account universe: the model every skill builds on (the signals feed
// monitors it, the research agent reads it, scoring writes to it).
//
// This is a NATIVE model: a workspace-owned companies table with no external
// source, so this example deploys with no connector and no env var. `kind: "native"`
// plus the `defineAccount` extractor give it the standard account schema (name,
// domain, industry, number_of_employees, annual_revenue, owner_id, ...).
//
// Contract for downstream skills: a string `domain` column as the identity
// key, and ideally a LinkedIn company URL.
//
// Fill it with a sourcing skill (tam-building, contact-sourcing), or
// source it from your CRM instead: add a CRM connector (see connectors/hubspot.ts in any CRM-backed skill) and swap this model for a
// connector-backed one.
//
//   import { hubspot } from "../connectors/hubspot";
//
//   export const accounts = defineModel("accounts", {
//     connector: hubspot,
//     extractSlug: "fetchRecords",
//     config: { objectType: "companies", columnSelectionMode: "all" },
//     schedule: { type: "cron", cron: "0 6 * * *" },
//     folder: modelsFolder,
//   });
export const accounts = defineModel("accounts", {
  kind: "native",
  extractSlug: "defineAccount",
  folder: modelsFolder,

  // The native `defineAccount` schema gives us id, name, industry, website,
  // linkedin_url, number_of_employees, annual_revenue, owner_id, billing_*, ...
  // (note: the identity key is `website`, not `domain`).
  //
  // These are the columns the skills write, declared once per example so the shared
  // schema stays in one place. Reference them as `accounts.columns.custom__<slug>`.
  additionalColumns: [
    {
      kind: "custom",
      slug: "cargo_score",
      type: "number",
      label: "Score",
      description: "Fit + intent score, written by the account-scoring skill.",
    },
    {
      kind: "custom",
      slug: "cargo_tier",
      type: "string",
      label: "Tier",
      description:
        "A / B / C tier derived from the score. Drives the tier segments.",
    },
    {
      kind: "custom",
      slug: "cargo_last_updated_at",
      type: "date",
      label: "Last enriched at",
      description:
        "When enrichment last refreshed this account. Drives staleness.",
    },
    {
      kind: "custom",
      slug: "owner_assigned_at",
      type: "date",
      label: "Owner assigned at",
      description:
        "When routing last assigned an owner. Drives per-rep capacity.",
    },
    {
      kind: "custom",
      slug: "lookalike_of",
      type: "string",
      label: "Lookalike of",
      description:
        "The won account this one mirrors. Written by closed-won-multiplier, so every sourced account stays traceable to the win that produced it.",
    },
  ],
});
