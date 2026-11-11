// The two settings an operator changes without touching the graph. Everything
// else in this skill is wired from them, so edit here, run `cargo-ai project plan`,
// and read what moved.

// How long an enrichment and its grade stand before the play enriches and
// grades the company again. The play filter enrols a row whose `scored_at` is
// older than this, so it is the refresh cadence, and every account is re-billed
// for its enrichment once per window. A new model version does not wait for
// it: the rescore play applies it to the stored values.
//
// The value is a segment filter's relative date: "<n> days", "<n> months" or
// "<n> years", compared by calendar day. "7 days" is weekly, "30 days" monthly.
// Write weeks as days: "1 week" is not a date unit the filter accepts.
export const rescoreAfter = "6 months";

// Where the grade goes besides the row. `none` writes only onto the Cargo model,
// which is what this skill did before the setting existed, and declares no CRM
// connector at all.
//
// `hubspot` or `salesforce` adds one update after the row write: it finds the
// CRM company matching this row and sets the three fields named below. It
// never creates a record, and it never writes a field you did not name here.
// When the match value finds more than one CRM company, it writes to none of
// them (`isFailingOnMultipleMatches` on the update, in tools/score-account.ts).
// The fields must exist in the CRM before the first run (see SKILL.md,
// `crm-writeback`).
export type CrmWriteback =
  | { crm: "none" }
  | {
      crm: "hubspot" | "salesforce";
      // Which value of the row finds the CRM company.
      //   "domain": the row's `domain`. HubSpot matches it on `domain`.
      //     Salesforce has no standard domain field, so name the Account field
      //     that holds a bare domain (often a custom `Domain__c`); `Website`
      //     holds URLs and will not match.
      //   "id": the row's `id`, only when the play runs on a CRM companies
      //     model, whose row id is the CRM record id. On `tam_companies` the
      //     id is Cargo's own and matches nothing.
      matchOn: "domain" | "id";
      // The CRM property compared to that value: `domain` or `hs_object_id`
      // on HubSpot, your domain field or `Id` on Salesforce.
      matchProperty: string;
      // The CRM properties written. Create them first: HubSpot company
      // properties, or Salesforce Account fields. Text for grade and reason,
      // date or datetime for the stamp.
      fields: { grade: string; reason: string; scoredAt: string };
    };

export const crmWriteback: CrmWriteback = { crm: "none" };

// A HubSpot example, by domain, for a play running on `tam_companies`:
//
// export const crmWriteback: CrmWriteback = {
//   crm: "hubspot",
//   matchOn: "domain",
//   matchProperty: "domain",
//   fields: {
//     grade: "cargo_fit_grade",
//     reason: "cargo_fit_reason",
//     scoredAt: "cargo_fit_scored_at",
//   },
// };

// Which column of the scored model holds each firmographic attribute of the
// fit model (`get.kind: "firmographic"` in context/icp/scoring.md). The
// enrichment reads these from the row instead of paying a provider for them.
// The contract fails when a firmographic attribute has no column here, or when
// the column is not in the play's input.
export const firmographicColumns: Record<string, string> = {
  employees: "employee_count",
};
