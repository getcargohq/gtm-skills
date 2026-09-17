---
title: Account fit scoring contract
description: Generated from the canonical feature and scoring contracts; do not edit.
---

# Account fit scoring

Approval: draft. Synthetic: true. Score version: developer-tools-score-v1. Feature version: developer-tools-features-v1.

This index measures structural fit, not readiness or a probability. Python computes it; the agent explains applied rules and evidence.

## Feature contract

```json
{
  "version": "developer-tools-features-v1",
  "seller_id": "developer-tools",
  "synthetic": true,
  "approval": {
    "state": "draft",
    "reference": null
  },
  "seller_research": {
    "product": "Developer deployment tooling",
    "users": ["Engineering managers"],
    "value_mechanism": "Deployment architecture affects value"
  },
  "features": [
    {
      "name": "employee_count",
      "type": "number",
      "critical": true,
      "role": "structural_fit",
      "unknown": "null",
      "definition": "Total account employee count at the snapshot date.",
      "units": "count",
      "minimum": 0,
      "hypothesis": "Synthetic mechanism for testing, not empirical evidence.",
      "live_extract": {
        "kind": "crm",
        "property": "numberofemployees"
      },
      "historical_source": "Dated CRM property history or verified historical company source.",
      "sufficient_evidence": "Dated account-level evidence covering the defined organization.",
      "insufficient_evidence": "An individual mentions a skill; a seller pitch; undated assertions.",
      "expected_coverage": "Measure in approved pilot",
      "cost": "Fetch live route prices before approval",
      "review_policy": "Review conflicts and unsupported values; unknown is null.",
      "refresh_days": 90,
      "extraction_version": "synthetic-v1"
    },
    {
      "name": "engineering_count",
      "type": "number",
      "critical": false,
      "role": "structural_fit",
      "unknown": "null",
      "definition": "Account engineering staff, using the approved role taxonomy.",
      "units": "count",
      "minimum": 0,
      "hypothesis": "Synthetic mechanism for testing, not empirical evidence.",
      "live_extract": {
        "kind": "cached_evidence"
      },
      "historical_source": "Dated role counts; current profiles alone cannot reconstruct history.",
      "sufficient_evidence": "Dated account-level evidence covering the defined organization.",
      "insufficient_evidence": "An individual mentions a skill; a seller pitch; undated assertions.",
      "expected_coverage": "Measure in approved pilot",
      "cost": "Fetch live route prices before approval",
      "review_policy": "Review conflicts and unsupported values; unknown is null.",
      "refresh_days": 90,
      "extraction_version": "synthetic-v1"
    },
    {
      "name": "deployment_architecture",
      "type": "category",
      "critical": true,
      "role": "structural_fit",
      "unknown": "null",
      "definition": "Account production deployment architecture.",
      "units": "category",
      "minimum": 0,
      "hypothesis": "Synthetic mechanism for testing, not empirical evidence.",
      "live_extract": {
        "kind": "cached_evidence"
      },
      "historical_source": "Dated architecture documentation.",
      "sufficient_evidence": "Dated account-level evidence covering the defined organization.",
      "insufficient_evidence": "An individual mentions a skill; a seller pitch; undated assertions.",
      "expected_coverage": "Measure in approved pilot",
      "cost": "Fetch live route prices before approval",
      "review_policy": "Review conflicts and unsupported values; unknown is null.",
      "refresh_days": 90,
      "extraction_version": "synthetic-v1",
      "values": ["cloud", "on_prem"]
    }
  ]
}
```

## Outcome and scoring contract

```json
{
  "version": "developer-tools-score-v1",
  "seller_id": "developer-tools",
  "synthetic": true,
  "approval": {
    "state": "draft",
    "reference": null
  },
  "feature_contract_version": "developer-tools-features-v1",
  "outcome": {
    "version": "developer-tools-outcome-v1",
    "tier_method": "absolute",
    "range": [0, 7],
    "thresholds": [
      {
        "tier": "Tier 3",
        "min": 0
      },
      {
        "tier": "Tier 2",
        "min": 2
      },
      {
        "tier": "Tier 1",
        "min": 4
      }
    ],
    "dimensions": [
      {
        "kind": "number",
        "missing_points": 0,
        "bands": [
          {
            "min": null,
            "max": 10000,
            "points": 0
          },
          {
            "min": 10000,
            "max": 40000,
            "points": 2
          },
          {
            "min": 40000,
            "max": null,
            "points": 4
          }
        ],
        "name": "realized_gross_margin",
        "source": "Billing less delivery costs in approved currency",
        "window": "First 180 days",
        "mature_after_days": 180,
        "immature_points": 0,
        "missing_policy": "unavailable",
        "boundary_conditions": "Lower inclusive, upper exclusive. Known failed observation is an observed zero; uncollected data is unavailable."
      },
      {
        "kind": "number",
        "missing_points": 0,
        "bands": [
          {
            "min": null,
            "max": 1,
            "points": 0
          },
          {
            "min": 1,
            "max": null,
            "points": 2
          }
        ],
        "name": "sustained_adoption",
        "source": "Product events in the approved measurement window",
        "window": "First 180 days",
        "mature_after_days": 180,
        "immature_points": 0,
        "missing_policy": "unavailable",
        "boundary_conditions": "Lower inclusive, upper exclusive. Known failed observation is an observed zero; uncollected data is unavailable."
      }
    ]
  },
  "model_evidence": {
    "status": "synthetic_only",
    "report": "No empirical validation or customer approval; fixtures exercise the engine."
  },
  "base_points": 0,
  "rules": [
    {
      "id": "employee_count-bands",
      "feature": "employee_count",
      "kind": "number",
      "missing_points": 0,
      "bands": [
        {
          "min": null,
          "max": 50,
          "points": 0
        },
        {
          "min": 50,
          "max": 500,
          "points": 35
        },
        {
          "min": 500,
          "max": null,
          "points": 15
        }
      ]
    },
    {
      "id": "engineering_count-bands",
      "feature": "engineering_count",
      "kind": "number",
      "missing_points": 0,
      "bands": [
        {
          "min": null,
          "max": 5,
          "points": 0
        },
        {
          "min": 5,
          "max": 30,
          "points": 15
        },
        {
          "min": 30,
          "max": null,
          "points": 25
        }
      ]
    },
    {
      "id": "architecture",
      "feature": "deployment_architecture",
      "kind": "category",
      "missing_points": 0,
      "points": {
        "cloud": 30,
        "on_prem": 0
      }
    }
  ],
  "gates": [
    {
      "id": "on-prem-policy",
      "basis": "policy",
      "cap": 20,
      "conditions": [
        {
          "feature": "deployment_architecture",
          "operator": "eq",
          "value": "on_prem"
        }
      ]
    }
  ],
  "interactions": [
    {
      "id": "engineering-cloud",
      "points": 10,
      "conditions": [
        {
          "feature": "engineering_count",
          "operator": "gte",
          "value": 30
        },
        {
          "feature": "deployment_architecture",
          "operator": "eq",
          "value": "cloud"
        }
      ]
    }
  ],
  "rounding": "half_up_integer",
  "score_range": [0, 100],
  "thresholds": [
    {
      "tier": "C",
      "min": 0
    },
    {
      "tier": "B",
      "min": 40
    },
    {
      "tier": "A",
      "min": 70
    }
  ]
}
```
