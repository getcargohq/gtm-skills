import { defineModel } from "@cargo-ai/cdk";

import { aiArk } from "../connectors/ai-ark";
import { modelsFolder } from "../folders/tam-building";

// The account universe: one row per company AI Ark returned for the approved
// ICP filter, tiered in place by ../plays/tier-companies.ts.
//
// THE FILTER IS THE TAM. There is no post-filter and no "source wide, then
// throw away": `fetchCompanies` bills per returned record, so a row that the
// rubric will disqualify was already paid for. Narrowing happens here, in
// `config`, and nowhere else.
//
// COUNT BEFORE YOU SOURCE. `aiArk.countCompanies` takes exactly these filter
// groups, returns `{"count": N}` and costs nothing:
//
//   cargo-ai orchestration action execute --wait-until-finished \
//     --action '{"kind":"connector","integrationSlug":"aiArk","actionSlug":"countCompanies","config":{}}' \
//     --data '{"industry":{"industry_or":["software development"]}, ...}'
//
// Run it for every candidate filter before deploying this. A free number is
// the whole difference between a market you chose and a market you discovered
// after paying for it.
//
// NO SCHEDULE, ON PURPOSE. A cron here re-runs the same search and bills for
// every returned record again, including the rows already sitting in this
// model: a monthly refresh buys the handful of new companies at the price of
// the entire pool. Sourcing is a deliberate spend, triggered when you decide to
// widen. The tiering play is the part that stands.
//
// And if you add a schedule and later delete the line, that does NOT clear a
// live cron: `ScheduleSpec` is optional with no null, the deploy engine omits
// the field when the spec is silent, and the platform keeps whatever cron it
// already has. Clear it at runtime instead:
//   cargo-ai storage model update --uuid <modelUuid> --schedule null
export const tamCompanies = defineModel("tam_companies", {
  connector: aiArk,
  extractSlug: "fetchCompanies",
  description:
    "The account universe sourced from AI Ark for the approved ICP filter, tiered in place by the tiering play.",
  folder: modelsFolder,

  // Written by the play, read by ../segments/tiers.ts. Declared here so the
  // schema lives in one place. Reference them as
  // `tamCompanies.columns.custom__<slug>` on the read side; the WRITE side
  // takes the bare slug (see the play).
  additionalColumns: [
    {
      kind: "custom",
      slug: "tier",
      type: "string",
      label: "Tier",
      description:
        "A, B, C, or disqualified. Written by the tiering agent through the play.",
    },
    {
      kind: "custom",
      slug: "tier_rationale",
      type: "string",
      label: "Tier rationale",
      description:
        "Two sentences naming the rubric lines that decided the tier, and the evidence behind them.",
    },
    {
      kind: "custom",
      slug: "tier_evidence_url",
      type: "string",
      label: "Tier evidence",
      description:
        "The page the agent verified against when the sourced firmographics were thin. Empty when it judged on the sourced facts alone.",
    },
    {
      kind: "custom",
      slug: "tiered_at",
      type: "date",
      label: "Tiered at",
      description:
        "When the tier was last written. This is the play's eligibility stamp: never tiered, or older than the refresh window.",
    },
  ],

  // PLACEHOLDER: the ICP, as AI Ark filter groups. This example is a technical
  // B2B software ICP; replace every value with yours.
  //
  // Filters are NESTED GROUPS, not a flat map. `{"industry": "Software"}` at
  // the top level is ignored silently and you source the whole database up to
  // `limit`. `_or` includes, `_not` excludes, and every one takes a string or
  // an array. Enum-backed fields (industry, seniority, department, funding
  // type, language) must be valid members: resolve them with the integration's
  // autocompletes (`listIndustries`, `listSeniorities`,
  // `listDepartmentsAndFunctions`, `listFundingTypes`) rather than guessing a
  // label. Numeric ranges are numbers, not strings.
  config: {
    industry: {
      industry_or: [
        "software development",
        "it services and it consulting",
        "technology, information and internet",
        "computer and network security",
      ],
    },
    employeeSize: { min_employee_count: 20, max_employee_count: 500 },
    companyType: { company_type_or: ["PRIVATELY_HELD", "PUBLIC_COMPANY"] },
    // The strongest single ICP signal available at sourcing time: the company
    // already employs the persona. Cheaper and sharper than sourcing on
    // firmographics alone and letting the agent discover the persona is absent.
    employeeRole: {
      employee_title_or: [
        "GTM Engineer",
        "Growth Engineer",
        "Revenue Operations",
        "Marketing Operations",
        "Sales Operations",
      ],
    },
    // PLACEHOLDER: the budget. Billing is per returned record, so this is the
    // one number that decides what a sync costs. Set it well under the counted
    // pool for the first run, watch the rows land and the tiers come back
    // sane, then widen.
    limit: 500,
  },
});
