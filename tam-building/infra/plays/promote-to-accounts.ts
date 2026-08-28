import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { cargoDb } from "../connectors/cargo";
import { accounts } from "../models/accounts";
import { salesNavCompanies } from "../models/salesnav-companies";

// Merge the extracted Sales Navigator rows into the real account universe.
//
// Two jobs, and the first one is not optional. A Sales Nav company row has a
// name and a LinkedIn company id, but NO domain, and `accounts` keys on
// `website`. So every row is resolved through Cargo's business database first:
// match on the company name, then pull firmographics to get the website. A row
// that cannot be resolved is dropped rather than written as a domainless
// account, because a domainless account poisons every downstream dedupe.
//
// Second job: the upsert itself. `matchingColumnSlug: website` is what makes
// this idempotent, which is what lets the same company appear in two overlapping
// sub-searches (it will: the split is by facet, and facets overlap) and still
// land as one account.
const promoteCompany = defineWorkflow(
  "promote-salesnav-company",
  {
    input: z.object({
      company_name: z.string(),
      sales_navigator_company_id: z.any(),
      number_employees: z.any(),
    }),
    output: z.object({ promoted: z.boolean() }),
    uses: { cargoDb },
  },
  ({ input, uses, model }) => {
    const match = uses.cargoDb.matchBusiness(
      { name: input.company_name },
      { continueOnFailure: true },
    );

    // No match means no domain, and no domain means we cannot dedupe it later.
    // Drop it: an unresolvable row is better lost than merged wrong.
    if (!match.business_id) {
      return { promoted: false };
    }

    const firmographics = uses.cargoDb.enrichBusinessFirmographics(
      { business_id: match.business_id },
      { continueOnFailure: true },
    );

    if (!firmographics.website) {
      return { promoted: false };
    }

    model.upsert({
      modelUuid: accounts.uuid as unknown as string,
      matchingColumnSlug: accounts.columns.website,
      matchingValue: firmographics.website,
      mappings: [
        { columnSlug: accounts.columns.website, value: firmographics.website },
        { columnSlug: accounts.columns.name, value: firmographics.name },
        {
          columnSlug: accounts.columns.industry,
          value: firmographics.linkedin_industry_category,
        },
        {
          columnSlug: accounts.columns.description,
          value: firmographics.business_description,
        },
        {
          columnSlug: accounts.columns.linkedin_url,
          value: firmographics.linkedin_profile,
        },
        // Headcount is deliberately NOT mapped from the Sales Nav row.
        // `number_employees` there is a range string ("51-200"), and the native
        // `number_of_employees` column is numeric. Writing one into the other
        // gives you a column that is silently empty or wrong. If you want
        // headcount, parse the range or take it from an enrichment provider that
        // returns a number.
        {
          columnSlug: accounts.columns.custom__cargo_last_updated_at,
          value: new Date(),
        },
      ],
    });

    return { promoted: true };
  },
);

// Fires as rows land from any of the sub-searches. Because the extractor
// auto-fetches, adding a new sub-search URL to the model is all it takes for its
// companies to flow through here into `accounts`.
//
// COST: this is the expensive play in the skill. Every promoted company costs
// two credited Cargo calls (matchBusiness + enrichBusinessFirmographics), and
// there is no cheaper way to get a domain, because Sales Nav does not return one.
// A 5,000-company TAM is therefore ~10,000 enrichment calls. That is the price of
// the outcome, not waste, but you should know it before you point this at a
// market-sized search.
//
// Under `watch`, this fires once per extracted row, so promotion is 1:1 with
// extraction: the number of promoted companies equals the number of rows the
// searches pull in. That means the real cost control is UPSTREAM, on the
// extraction cap in ../models/salesnav-companies.ts (`config.limit`, and how many
// sub-search URLs you add). A play-level `limit` would do nothing here: watch has
// no batched run for it to cap. To throttle instead of extracting everything,
// lower the extraction cap or add fewer sub-searches, then widen once a small run
// has landed correctly.
export const promoteToAccounts = definePlay("promote-to-accounts", {
  model: salesNavCompanies,
  workflow: promoteCompany,
  changeKinds: ["added"],
  runCreationRule: "always",
  schedule: { type: "watch" },
});
