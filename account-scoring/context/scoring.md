---
title: Scoring model
description: PLACEHOLDER. The fit model account-scoring applies. Written by win-loss-review's scoring pass from your own deals; this example shows the shape. Code reads only the json block under Model.
model_version: 1
built: 2026-11-11
window: 2025-11-01 to 2026-10-31
cohort: "12 Tier 1 · 38 Tier 2 · 9 churned · 63 lost"
confidence: hypothesis
---

# Scoring model

PLACEHOLDER, and the file every grade comes from. In a project it lives at
`context/icp/scoring.md`, written by `win-loss-review`'s scoring pass. A company with no closed
deals to learn from writes it by hand in this shape and keeps `confidence: hypothesis`. After any
change, run `node scripts/account-scoring/sync-model.mjs` and deploy: the enrichment and the scoring
read the block below through the model it generates.

## Summary

Tier 1 customers renewed or expanded, went live within 45 days, and sat in the lower half for
support load. What separates them from Tier 2 most is a data team of twenty or more and a business
that runs on its users' behavior (a marketplace or a consumer subscription). Companies under 50
employees, agencies and resellers are No Fit. Confidence is a hypothesis: twelve Tier 1 accounts.

## Tier 1

Renewed at least once or expanded, live within 45 days of signature, support load in the lower half
of the cohort. Tier 1 → Strong, Tier 2 → Moderate, the lost and churned profile → Weak, the filters
→ No Fit.

## Model

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

## Why each attribute

- **Data team size.** A team that can own the pipeline goes live faster. 9 of 12 Tier 1 have 20 or
  more, against 7 of 38 Tier 2; it held in the period before. Coverage: 41 of 50 customers.
- **Business model.** Behavior drives revenue in a marketplace or a subscription. 10 of 12 Tier 1,
  against 14 of 38 Tier 2; held. Coverage: 50 of 50.
- **Real-time personalization.** 6 of 12 Tier 1 run it live, against 5 of 38 Tier 2; held.
  Coverage: 33 of 50.
- **Mobile apps.** 8 of 12 Tier 1 publish on both stores, against 12 of 38 Tier 2; not checked in the
  period before (too few deals). Coverage: 50 of 50.
- **Warehouse (modifier).** Snowflake or Databricks at 7 of 12 Tier 1 and 15 of 38 Tier 2: a small
  gap, kept as a modifier.
- **Under 50 employees (filter).** 0 of 12 Tier 1 and 1 of 38 Tier 2.
- **Agencies and resellers (filter).** Never targeted; no customer in the window.

## Tested and dropped

- Funding stage: carried by size and data team already.
- Uses our API: only visible after buying.

## Timing signals

Not scored here: a customer-facing AI launch, a CDP replacement project, a new head of data.

## Open questions

- Does real-time personalization hold on next year's deals? 33 of 50 customers had evidence.
