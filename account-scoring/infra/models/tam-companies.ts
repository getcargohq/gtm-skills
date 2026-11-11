import { defineModel } from "@cargo-ai/cdk";

import { aiArk } from "../connectors/ai-ark";
import { modelsFolder } from "../folders";
import { fitModel } from "../model";

// The account universe this skill grades: tam-building's `tam_companies`, with
// columns added for every attribute of the fit model (its value and the
// evidence behind it), the grade, and the two stamps.
//
// THIS IS A COPY. tam-building owns this model and its filter. A cookbook
// carries every resource it imports, so the copy is here for the case where
// account-scoring is installed alone, but the expected install is after
// tam-building: then move `additionalColumns` below onto tam-building's
// declaration (`infra/tam-building/models/tam-companies.ts`), point the plays,
// the tools and the segments at that export, and delete this file. One slug
// declared twice collides at deploy.
//
// A sync of the model replaces its rows. Custom column values survive on the
// companies the sync returns again, so re-sourcing the same market keeps their
// values and grades, and the play only enriches the new rows.

// One value column and one evidence column per attribute, generated from the
// model: a new attribute in scoring.md is a new column at the next plan. The
// value columns are what reps, the cockpit and other agents read; the rescore
// reads them back instead of paying for the enrichment again.
const attributeColumns = fitModel.attributes.flatMap((attribute) => [
  {
    kind: "custom" as const,
    slug: `fit_${attribute.slug}`,
    type:
      attribute.type === "number" ? ("number" as const) : ("string" as const),
    label: attribute.label,
    description: `${attribute.definition} From: ${attribute.get.how}. Written by the enrichment; "unknown" (or empty for a number) when no source had it.`,
  },
  {
    kind: "custom" as const,
    slug: `fit_${attribute.slug}_evidence`,
    type: "string" as const,
    label: `${attribute.label} (evidence)`,
    description: `Where the ${attribute.label.toLowerCase()} value came from: a page URL for research, the provider for a provider attribute, the account record for a firmographic one.`,
  },
]);

export const tamCompanies = defineModel("tam_companies", {
  connector: aiArk,
  extractSlug: "fetchCompanies",
  description:
    "The account universe sourced from AI Ark, enriched for the fit model and graded Strong / Moderate / Weak / No Fit in place by account-scoring.",
  folder: modelsFolder,

  // Everything lives on the row it describes, so a segment over this model is
  // a plain filter and the rows a re-sync keeps keep their values. Workflows
  // write these with their bare slugs; reads see them as `custom__<slug>`.
  additionalColumns: [
    ...attributeColumns,
    {
      kind: "custom",
      slug: "fit_grade",
      type: "string",
      label: "Fit grade",
      description:
        "Strong, Moderate, Weak or No Fit, computed by code from the fit model in context/icp/scoring.md.",
    },
    {
      kind: "custom",
      slug: "fit_score",
      type: "number",
      label: "Fit score",
      description:
        "The total out of 100: weights plus modifiers, unknown values at half their weight. Reported for No Fit too.",
    },
    {
      kind: "custom",
      slug: "fit_breakdown",
      type: "string",
      label: "Fit breakdown",
      description:
        "Every weighted attribute with its value and points, and the No Fit filter that fired, written by code.",
    },
    {
      kind: "custom",
      slug: "fit_reason",
      type: "string",
      label: "Fit reason",
      description:
        "Two sentences for a rep, written by the scoring agent from the breakdown. It explains the grade; it never sets it.",
    },
    {
      kind: "custom",
      slug: "fit_model_version",
      type: "number",
      label: "Fit model version",
      description:
        "The model_version of scoring.md the grade was computed with. The rescore play picks rows below the current one.",
    },
    {
      kind: "custom",
      slug: "enriched_at",
      type: "date",
      label: "Enriched at",
      description: "When the attribute values were last collected.",
    },
    {
      kind: "custom",
      slug: "scored_at",
      type: "date",
      label: "Scored at",
      description:
        "When the grade was last written. The scoring play's eligibility stamp: never scored, or older than the refresh window.",
    },
  ],

  // PLACEHOLDER: tam-building's filter, kept so this copy deploys on its own.
  // Replace it with the approved one, or drop the file as described above.
  config: {
    industry: {
      industry_or: [
        "software development",
        "it services and it consulting",
        "technology, information and internet",
      ],
    },
    employeeSize: { min_employee_count: 20, max_employee_count: 500 },
    companyLocation: {
      location_or: ["United States", "United Kingdom"],
    },
    limit: 500,
  },
});
