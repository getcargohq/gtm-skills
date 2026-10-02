/**
 * The choices the collector needs. None of them is a credential: pages are
 * fetched as any visitor would, and the news search reaches Cargo through
 * `cargo-ai`, which the harness sandbox is already signed in to.
 */

/**
 * PLACEHOLDER: the company's own domain, bare (`acme.com`, no scheme, no
 * `www.`). The collector refuses to run while it is the placeholder: every file
 * the agent writes is about this company, and a wrong domain is a wrong
 * knowledge base.
 */
export const DOMAIN = "PLACEHOLDER_COMPANY_DOMAIN";

/**
 * The pages read every week, as paths on the domain. A path that answers 404
 * is recorded as missing and skipped, not as an error, so the default list is
 * safe on a site that has no changelog. Replace it with the site's real
 * sections at install; the sitemap is the place to look.
 */
export const PAGES = [
  "/",
  "/pricing",
  "/customers",
  "/careers",
  "/blog",
  "/changelog",
];

/**
 * How far back the first run's news search looks, in days. Every later run
 * searches from the date of the last committed snapshot, so a week with
 * nothing to report (no pull request, no snapshot committed) is covered by the
 * next run rather than skipped.
 */
export const FIRST_RUN_NEWS_DAYS = 90;

/**
 * `parallel.createTask` processor for the news search. `lite` is the cheapest
 * rung of a price ladder whose top rungs cost far more, and it is a required field
 * with no default.
 */
export const NEWS_PROCESSOR = "lite";

/** Text kept per page in the snapshot. A page longer than this is cut. */
export const PAGE_CHARS = 20000;

/**
 * Below this much text, a fetched page is probably rendered by JavaScript and
 * the plain fetch saw an empty shell: the collector reads it again through
 * `parallel.extract`, which renders it. Billed per URL.
 */
export const MIN_PAGE_CHARS = 500;
