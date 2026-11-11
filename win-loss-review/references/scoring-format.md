# The shape of `context/icp/scoring.md`

`scoring.md` is read twice: by people, who need the reasoning, and by the scorer, which needs
numbers it can compute without interpreting prose. So it holds both, in this order, and the block
under `## Model` is the only part code reads.

Frontmatter follows the repository's `context/icp/_template.md`, plus four fields: `model_version`
(an integer, raised on every rebuild), `built` (the date), `window` (the closed-deal window the
model was built on) and `cohort` (the counts per class). `confidence` is `validated` when the
monthly agent's mode was verify, else `hypothesis`.

## Sections

1. `## Summary`: the Tier 1 rule in one sentence, the attributes that matter most, the No Fit
   filters, and how confident the model is and why.
2. `## Tier 1`: the rule in relative terms (thirds, medians, renewed or not), never an amount, and
   how the classes map to fit grades: Tier 1 → Strong, Tier 2 → Moderate, the lost and churned
   profile → Weak, the filters → No Fit.
3. `## Model`: the block below.
4. `## Why each attribute`: one short block per filter, attribute and modifier: the definition, the
   reason in one or two sentences, the evidence line with both groups and the sample, whether it held
   in the period before, the coverage, and how to get it for any company.
5. `## Tested and dropped`: every candidate that did not earn a weight, and why in one line.
6. `## Timing signals`: the live signals the research found. Not scored here.
7. `## Open questions`: what could not be tested, and what would settle it.

Every count is "n of N", every number traces to `outputs/<date>-win-loss-scoring/README.md`, and no
amount, email or person appears.

## The model block

A fenced `yaml` block. Fictional values:

```yaml
model_version: 1
filters: # No Fit. Evaluated first; any match is No Fit. A filter never fires on unknown.
  - attribute: employees
    below: 50
    why: "0 of 12 Tier 1 and 1 of 38 Tier 2 under 50 employees"
  - attribute: business_model
    in: [agency, reseller]
    why: "never targeted (team answer); no customer in the window"
attributes: # weights sum to 100; an attribute's best value scores its weight
  - slug: data_team_size
    label: People in data, analytics and ML roles
    type: number
    weight: 35
    get: "headcount by function from Sales Navigator: data, analytics, data engineering, ML titles"
    ranges: # first match from the top, value >= min
      - { min: 20, points: 35 }
      - { min: 8, points: 20 }
      - { min: 0, points: 0 }
    unknown: 17
  - slug: business_model
    label: Business model
    type: enum
    weight: 30
    get: "research the homepage, pricing and product pages; one label"
    values:
      marketplace: 30
      consumer_subscription: 24
      b2b_saas: 10
      mostly_offline: 0
    unknown: 15
  - slug: realtime_personalization
    label: Real-time personalization in production
    type: enum
    weight: 20
    get: "research product pages and engineering posts; live in-session only with implementation evidence"
    values:
      live: 20
      pilot: 12
      batch_or_rules: 4
      none_seen: 0
    unknown: 10
  - slug: mobile_apps
    label: Native mobile apps
    type: enum
    weight: 15
    get: "app store listings"
    values:
      ios_and_android: 15
      one_platform: 8
      none: 0
    unknown: 7
modifiers: # small, outside the 100, never enough to lift a filtered account
  - slug: warehouse
    label: Cloud warehouse in use
    type: enum
    get: "job postings and engineering pages, company-wide use only"
    values:
      snowflake: 5
      databricks: 5
      bigquery: 3
    unknown: 0
bands: # on the total after filters
  strong: 70 # 70 and above
  moderate: 45 # 45 to 69; below 45 is Weak
```

## Rules the block obeys

- **Outside-visible only.** Every filter, attribute and modifier can be filled for a company that
  has never been a customer, and `get` says how. No usage, billing, health or CRM-only field.
- **Weights sum to 100.** Points are integers; an attribute's best value scores exactly its weight.
- **Unknown is neutral.** An attribute's `unknown` is half its weight, rounded down; a modifier's is
  0; a filter never fires on unknown.
- **Code computes.** An agent fills the values (a label from the allowed list, or a number); a
  script reads this block and computes the points, the total and the band. An agent never writes
  points.
- **One version at a time.** A rebuild raises `model_version` and replaces the block; the monthly
  agent never edits it.
