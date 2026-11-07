// Everything a company changes lives in this file. The rest of the board is
// generic: it reads whatever these settings point at.

// The dataset the Cargo Signals models sync into. Storage names a model's table
// `<connector slug>.<model slug>`, so this is the slug of the connector in
// infra/connectors/cargo-signals.ts. Change both together.
export const DATASET = "cargo_signals";

// The engagement models declared in infra/models/post-engagement.ts, one entry
// per model. Each is queried on its own: in a storage UNION ALL only the first
// leg's model reference is resolved.
export const MODELS = ["post_reactors", "post_commenters"] as const;

export type Author = { handle: string; name: string; ours: boolean };

// Every LinkedIn profile the models watch, keyed by the handle in its URL
// (linkedin.com/in/<handle>). `ours: true` for your own people; `ours: false`
// for the adjacent founders of the `with-adjacent` variation, whose engagers
// count at `SCORING.adjacentFactor`. A row whose profile is missing here is
// dropped and named in a warning at the top of the board, so add a profile here
// in the same change that adds it to the models.
export const AUTHORS: Record<string, Author> = {
  // PLACEHOLDER: the profiles in `trackedProfiles` in infra/models/post-engagement.ts.
  "dana-ruiz-fabrikam": {
    handle: "dana-ruiz-fabrikam",
    name: "Dana",
    ours: true,
  },
  "sam-okafor": { handle: "sam-okafor", name: "Sam", ours: true },
};

// What the "adjacent" filter and the score help call those other founders,
// e.g. "Contoso and Northwind founders". Unused until `with-adjacent`.
export const ADJACENT_LABEL = "adjacent founders";

// ICP fit, shown beside the score as a badge and a filter. It never decides who
// is kept: every engager is on the board. Written from the ICP and personas in
// the workspace context when the cookbook is installed.
export const ICP = {
  // PLACEHOLDER: the titles of the people who buy from you.
  titles:
    /\b(revops|rev ops|revenue operations|sales operations|marketing operations|head of sales|vp,? (sales|marketing)|cro|cmo|founder|co-?founder|ceo)\b/i,
  excludedTitles: /\b(recruit|talent|student|intern|freelance)/i,
  // PLACEHOLDER: the LinkedIn employee ranges you sell to, verbatim.
  employeeRanges: ["11-50", "51-200", "201-500", "501-1000", "1001-5000"],
  // PLACEHOLDER: industries that look like buyers and never are.
  excludedIndustries:
    /staffing|consulting|marketing services|advertising|venture capital/i,
  // PLACEHOLDER: your own website and LinkedIn company page, so your team never
  // ranks as a prospect.
  ownCompany: /fabrikam\.com|linkedin\.com\/company\/fabrikam/i,
};

// SCORE. Deterministic on purpose: the same rows always give the same ranking,
// so a person moving up the board means they engaged again, not that a model
// changed its mind. A comment costs the person effort, a reaction one click.
// Engagement on an adjacent founder's post says the person is shopping the
// category, which matters but is not about you. Points halve every
// `halfLifeDays` so the board ranks who is warm now, and repeat engagement adds
// up because every engagement contributes.
export const SCORING = {
  comment: 3,
  reaction: 1,
  adjacentFactor: 0.5,
  halfLifeDays: 21,
};

// The source filter and the adjacent tile only appear when some profile above
// is not yours.
export const HAS_ADJACENT = Object.values(AUTHORS).some(
  (author) => !author.ours,
);
