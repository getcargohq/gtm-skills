import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../../base-gtm/folders/gtm";
import { salesNav } from "../../base-gtm/connectors/sales-navigator";

// The raw landing table for Sales Navigator company searches.
//
// THE SPLIT IS THE WHOLE POINT. An account search should stay under 1,000
// results, and the honest way to build a market that is bigger than the cap is
// not one giant search: it is N sub-searches, each under the cap, unioned here.
//
// `urls` takes the whole list, so the recursion lives in the config rather than
// in code: count each search with the `count-search` tool first (see
// ../tools/count-search.ts), split any oversized one by facet, and add the
// resulting sub-search URLs below. Rows from every URL land in this one model.
//
// Splitting facets, in the order that usually works: industry first (the
// LinkedIn industry taxonomy has three levels, so descend from Level 1 into
// Level 2/3 only for the segments that are still too big), then geography, then
// headcount band.
//
// Extracted columns: company_name, description, category, number_employees,
// sales_navigator_company_id, sales_navigator_company_url,
// sales_navigator_employees_url, sales_navigator_search_url. Note there is NO
// domain here, which is why ../plays/promote-to-accounts.ts resolves one before
// anything is promoted into the real accounts model.
export const salesNavCompanies = defineModel("salesnav_companies", {
  connector: salesNav,
  extractSlug: "fetchAccountSearch",
  config: {
    // PLACEHOLDER: one Sales Navigator company-search URL per sub-search, each
    // counted under the 1,000 cap. Start with your whole-market search, count
    // it, and split until every URL here is under the cap.
    urls: [
      "https://www.linkedin.com/sales/search/company?query=PLACEHOLDER-sub-search-1",
      "https://www.linkedin.com/sales/search/company?query=PLACEHOLDER-sub-search-2",
    ],
    // The per-search extraction cap. Keep at or below 1,000: a search that hits
    // this number is truncated, which is the failure this cookbook exists to
    // prevent.
    limit: 1000,
  },
  folder: modelsFolder,
});
