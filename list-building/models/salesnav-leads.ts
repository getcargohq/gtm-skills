import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders/gtm";
import { salesNav } from "../connectors/sales-navigator";

// The landing table for Sales Navigator people searches.
//
// Same recursive split as tam-building, one difference that matters: the cap for
// people searches is 2,500, not 1,000. Count each search from the CLI first (see
// the README), split anything oversized, and list the final sub-search URLs
// here. Rows from every URL land in this one table.
//
// Splitting facets for people, in the order that usually works: geography, then
// function, then seniority, then industry.
//
// Extracted columns include: first_name, last_name, full_name, job_title,
// headline, current_company, company_name, location, connection_degree,
// linkedin_profile_id, linkedin_profile_url, sales_navigator_profile_id,
// sales_navigator_profile_url, sales_navigator_company_id, recently_hired,
// recently_promoted, tenure_start/end/length. Note there is NO email: the
// promotion play resolves one before anything reaches `contacts`.
export const salesNavLeads = defineModel("salesnav_leads", {
  connector: salesNav,
  extractSlug: "fetchLeadSearch",
  config: {
    // PLACEHOLDER: one Sales Navigator PEOPLE-search URL per sub-search, each
    // counted under the 2,500 cap.
    urls: [
      "https://www.linkedin.com/sales/search/people?query=PLACEHOLDER-sub-search-1",
      "https://www.linkedin.com/sales/search/people?query=PLACEHOLDER-sub-search-2",
    ],
    // Keep at or below 2,500. A search that returns exactly this number is
    // truncated: split it instead of accepting the truncation.
    limit: 2500,
  },
  folder: modelsFolder,
});
