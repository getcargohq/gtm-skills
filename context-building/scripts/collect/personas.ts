/**
 * The persona pulls: what to ask TheirStack for, per persona.
 *
 * PLACEHOLDER, twice over. Two personas ship so the collector has something to
 * run against; the bootstrap agent replaces them with the personas confirmed
 * at the three-line check, one entry each, before it runs the pull. Slugs are
 * snake_case and become the raw file name and, if you later declare a standing
 * model, its slug.
 *
 * The band is the ICP's, and it is applied AT PULL TIME (see `band` in the
 * type). Titles are exact matches, so list the real titles the persona goes
 * by rather than a family name; exclusions are exact words on the title and
 * are what keep "Sales Operations" from returning a retail store's ops lead.
 *
 * The same shape, `PersonaPull`, is what infra/context-building/models/
 * persona-jobs.ts builds a standing model from. When you declare one, copy the
 * entry from here byte for byte.
 */
export type PersonaPull = {
  slug: string;
  titles: string[];
  exclude: string[];
  band: { min: number; max: number };
  limit: number;
  postedWithinDays?: number;
};

export const PERSONA_PULLS: PersonaPull[] = [
  {
    slug: "revenue_operations",
    titles: [
      "Revenue Operations Manager",
      "Head of Revenue Operations",
      "Director of Revenue Operations",
      "RevOps Manager",
    ],
    exclude: ["intern", "recruiter", "analyst", "assistant"],
    band: { min: 50, max: 500 },
    limit: 40,
  },
  {
    slug: "head_of_growth",
    titles: ["Head of Growth", "VP Growth", "Director of Growth"],
    exclude: ["intern", "recruiter", "product growth", "growth engineer"],
    band: { min: 50, max: 500 },
    limit: 40,
  },
];

/** The extractor config for a pull, identical to the standing model's. */
export const pullConfig = (pull: PersonaPull) => ({
  limit: pull.limit,
  fields: {
    job_title_or: pull.titles,
    job_title_not: pull.exclude,
    hiring_managers_exists: false,
    posted_at_max_age_days: pull.postedWithinDays ?? 120,
  },
  companyFields: {
    company_type: "direct_employer",
    min_employee_count: pull.band.min,
    max_employee_count: pull.band.max,
  },
});
