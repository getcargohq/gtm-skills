import { defineModel, type FolderHandle } from "@cargo-ai/cdk";

import { theirStack } from "../connectors/theirstack";

/**
 * A standing job-posting model per persona, built from the same spec the
 * bootstrap's collector pulls with.
 *
 * NOTHING IS DEPLOYED FROM THIS FILE BY DEFAULT, and that is the point of it.
 * A `defineModel` here is created at deploy and runs at creation, billing
 * `limit` postings per persona before anyone has confirmed the persona is
 * real. The bootstrap pulls through the `searchJobs` action instead
 * (scripts/context-building/collect/jobs.ts): same filters, same rows, same
 * `company_object` on every row, nothing deployed, so the postings the agent
 * reads and the persona files it writes land in one pull request.
 *
 * Declare a model here AFTER the bootstrap, for a persona you want to keep
 * watching: `fetchJobs` is an incremental extractor, so a scheduled model only
 * bills the postings it has not seen, and the monthly refresh can read what
 * is new. Copy the confirmed pull out of
 * scripts/context-building/collect/personas.ts, byte for byte: the two files
 * carry the same `fields` and `companyFields` so a reader can check that the
 * rows in cadence/log/raw/jobs/ are the rows the model will keep pulling.
 *
 *   import { defineFolder } from "@cargo-ai/cdk";
 *   const modelsFolder = defineFolder("context-building-models", {
 *     kind: "model",
 *     name: "Context building",
 *   });
 *   export const revenueOperationsJobs = personaJobsModel(
 *     {
 *       slug: "revenue_operations",
 *       titles: ["Revenue Operations Manager", "Head of Revenue Operations"],
 *       exclude: ["intern", "recruiter", "analyst"],
 *       band: { min: 50, max: 500 },
 *       limit: 40,
 *     },
 *     modelsFolder,
 *   );
 *
 * A model created some other way (by hand, or by a script) is NOT adopted by
 * a later declaration with the same slug: the deploy stops on `duplicateSlug`
 * and the way out is `cargo-ai cdk import model:<slug> <uuid>`. Declare it
 * here first, then deploy.
 */
export type PersonaPull = {
  /** Snake_case; the model slug is `persona_jobs_<slug>`. */
  slug: string;
  /** Exact-title matches, case-insensitive. Short list, real titles. */
  titles: string[];
  /** Exact-word exclusions on the title. Keep them short. */
  exclude: string[];
  /**
   * The ICP size band, applied AT PULL TIME through `companyFields`. Every
   * returned row is billed, so a row outside the band is a row you paid for
   * and will throw away. Never filter size after the pull.
   */
  band: { min: number; max: number };
  /** The budget for this persona: billing is per returned posting. */
  limit: number;
  /** Postings older than this are stale for describing a job. */
  postedWithinDays?: number;
};

/**
 * The extractor config for a pull, shared with the collector so the standing
 * model and the one-shot action ask TheirStack the same question. `company_type:
 * "direct_employer"` drops staffing agencies, whose postings describe a
 * client's job in an agency's words; `hiring_managers_exists: false` keeps the
 * cheaper tier of row, since the persona work reads descriptions, not names.
 */
export const personaPullConfig = (pull: PersonaPull) => ({
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

/**
 * One standing model for one persona. No schedule by default: add
 * `schedule: { type: "cron", cron: "0 6 1 * *" }` to have the refresh find new
 * postings each month, and remember that deleting the line later does not
 * clear a live cron (`cargo-ai storage model update --uuid <uuid> --schedule
 * null` does).
 */
export const personaJobsModel = (pull: PersonaPull, folder?: FolderHandle) =>
  defineModel(`persona_jobs_${pull.slug}`, {
    connector: theirStack,
    extractSlug: "fetchJobs",
    name: `Persona jobs: ${pull.slug.replace(/_/g, " ")}`,
    description:
      "Job postings for one confirmed persona, inside the ICP size band, read to write and refresh the persona file.",
    config: personaPullConfig(pull),
    ...(folder === undefined ? {} : { folder }),
  });
