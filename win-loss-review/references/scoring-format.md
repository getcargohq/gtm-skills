# The shape of `context/icp/scoring.md`

`scoring.md` is the fit model. `win-loss-review`'s scoring pass writes it from your best customers;
`account-scoring` applies it to every company in the market. It is read by people, who need the
reasoning, and by code, which needs numbers it can compute without interpreting prose. So it holds
both, and the fenced `json` block under `## Model` is the only part code reads.

Frontmatter follows the repository's `context/icp/_template.md`, plus `model_version` (an integer,
raised on every rebuild), `built` (the date), `window` (the closed-deal window it was built on),
`cohort` (the counts per class) and `confidence` (`validated` or `hypothesis`).

## Sections

1. `## Summary`: the Tier 1 rule in one sentence, the attributes that matter most, the No Fit
   filters, and how confident the model is and why.
2. `## Tier 1`: the rule in relative terms (thirds, medians, renewed or not), never an amount, and
   how the classes map to fit grades: Tier 1 → Strong, Tier 2 → Moderate, the lost and churned
   profile → Weak, the filters → No Fit.
3. `## Model`: the block below.
4. `## Why each attribute`: one short block per attribute: the reason in one or two sentences, the
   evidence line with both groups and the sample, whether it held in the period before, and the
   coverage.
5. `## Tested and dropped`: every candidate that did not earn a weight, and why in one line.
6. `## Timing signals`: the live signals the research found. Not scored.
7. `## Open questions`: what could not be tested, and what would settle it.

Every count is "n of N", every number traces to the scoring pass's run record, and no amount, email
or person appears.

## The model block

Two halves, because two steps read it. `attributes` is **what to collect** about a company, and
how: account-scoring's enrichment step reads it. `filters`, `weights`, `modifiers` and `bands` are
**how to score** what was collected: its compute step reads them. Fictional values:

```json
{
  "model_version": 1,
  "attributes": [
    {
      "slug": "employees",
      "label": "Employees",
      "type": "number",
      "definition": "Total headcount of the company.",
      "get": {
        "kind": "firmographic",
        "how": "the headcount on the account record"
      }
    },
    {
      "slug": "business_model",
      "label": "Business model",
      "type": "enum",
      "values": [
        "marketplace",
        "consumer_subscription",
        "b2b_saas",
        "media_content",
        "mostly_offline",
        "agency",
        "reseller"
      ],
      "definition": "How the company makes money from its digital product. Agencies and resellers sell services or other vendors' software.",
      "get": {
        "kind": "research",
        "how": "homepage, pricing and product pages"
      }
    },
    {
      "slug": "data_team_size",
      "label": "People in data roles",
      "type": "number",
      "definition": "Employees whose current title is in data, analytics, data engineering or machine learning.",
      "get": { "kind": "provider", "how": "LinkedIn headcount for data titles" }
    },
    {
      "slug": "realtime_personalization",
      "label": "Real-time personalization",
      "type": "enum",
      "values": ["live", "pilot", "batch_or_rules", "none_seen"],
      "definition": "Whether the product adapts to a user's behavior within the same session. Live needs implementation evidence (engineering posts, product pages), not a marketing claim.",
      "get": {
        "kind": "research",
        "how": "product pages and engineering posts"
      }
    },
    {
      "slug": "mobile_apps",
      "label": "Native mobile apps",
      "type": "enum",
      "values": ["ios_and_android", "one_platform", "none"],
      "definition": "Native apps the company publishes in the App Store and Google Play.",
      "get": { "kind": "research", "how": "app store listings" }
    },
    {
      "slug": "warehouse",
      "label": "Cloud warehouse",
      "type": "enum",
      "values": ["snowflake", "databricks", "bigquery", "redshift", "other"],
      "definition": "The cloud data warehouse in company-wide use. One job post naming a tool is not company-wide use.",
      "get": { "kind": "research", "how": "engineering posts and job posts" }
    }
  ],
  "filters": [
    {
      "attribute": "employees",
      "below": 50,
      "why": "0 of 12 Tier 1 and 1 of 38 Tier 2 under 50 employees"
    },
    {
      "attribute": "business_model",
      "in": ["agency", "reseller"],
      "why": "never targeted (team answer); no customer in the window"
    }
  ],
  "weights": [
    {
      "attribute": "data_team_size",
      "weight": 35,
      "ranges": [
        { "min": 20, "points": 35 },
        { "min": 8, "points": 20 },
        { "min": 0, "points": 0 }
      ],
      "unknown": 17
    },
    {
      "attribute": "business_model",
      "weight": 30,
      "points": {
        "marketplace": 30,
        "consumer_subscription": 24,
        "media_content": 12,
        "b2b_saas": 10,
        "mostly_offline": 0
      },
      "unknown": 15
    },
    {
      "attribute": "realtime_personalization",
      "weight": 20,
      "points": {
        "live": 20,
        "pilot": 12,
        "batch_or_rules": 4,
        "none_seen": 0
      },
      "unknown": 10
    },
    {
      "attribute": "mobile_apps",
      "weight": 15,
      "points": { "ios_and_android": 15, "one_platform": 8, "none": 0 },
      "unknown": 7
    }
  ],
  "modifiers": [
    {
      "attribute": "warehouse",
      "points": { "snowflake": 5, "databricks": 5, "bigquery": 3 },
      "unknown": 0
    }
  ],
  "bands": { "strong": 70, "moderate": 45 }
}
```

## Rules the block obeys

- **Outside-visible only.** Every attribute can be filled for a company that has never been a
  customer. `get.kind` says how: `firmographic` (on any company record: headcount, industry,
  country), `provider` (a data provider action), or `research` (public pages, read for one label).
  No usage, billing, health or CRM-only field.
- **Research attributes are enums.** A label is picked from `values` or left unknown; a number comes
  from a record or a provider, never from reading a page.
- **Weights sum to 100.** Points are integers, and an attribute's best value scores exactly its
  weight. A value missing from `points`, or below every range, scores 0.
- **Unknown is neutral.** A weighted attribute's `unknown` is half its weight, rounded down; a
  modifier's is 0. A filter never fires on unknown.
- **Filters first.** Any filter that fires makes the company No Fit (`below`, `above` or `in`), with
  its `why`. Otherwise the total of weights and modifiers, held between 0 and 100, sets the band:
  Strong at `strong` or above, Moderate at `moderate` or above, Weak below.
- **Know where "nothing known" lands.** A company with every attribute unknown scores the sum of
  the halves, about 50. Set the Moderate band with that in mind, or thin-data companies fill it.
- **Modifiers stay small:** at most 10 points either way, outside the 100, never enough to lift a
  filtered company.
- **Code computes.** The enrichment step fills values; a script reads this block and computes the
  points, the total and the band. No agent writes points.
- **One version at a time.** A rebuild raises `model_version` and replaces the block.
