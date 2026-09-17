# Calibration and custom evidence

The seller is the Cargo customer. Its accounts are the population being evaluated.
Research the seller once; apply one approved definition of each datapoint to all
accounts. Calibration is a reviewed project, not a scheduled training job.

## Audit artifacts

Keep customer artifacts in the private customer project, never this public repository.
Record the audit date, workspace identity and access basis. Build a source map with
system, object, stable ID, join key, owner, authoritative fields, earliest/latest
history, record count, missing/conflicting share and lookup reference. Reconcile
account IDs with acquisition opportunity IDs and billing/customer IDs before labels.
Flag negative ages, close-before-create, duplicated episodes, currencies and units.
Seller ARR from an account and the account's own company revenue occupy distinct
columns. Preserve revenue, ARR, run-rate and GMV types and measurement periods.

Inventory CRM property history, billing, churn, usage, support, CSM, historical
providers and transcripts. An absent integration is an access gap, not proof that
recordings or historical data do not exist. Resolve source conflicts; ask only about
useful unavailable sources. Read-only schema inspection precedes priced extraction.

Create a cohort manifest with account_id, episode_id, opportunity_id, kind, stage,
created_at, closed_at, fit_snapshot_at, snapshot_anchor, age_days, split and exclusions.
Start at 24 months and all acquisition episodes; preserve churned wins. Exclude
renewals/upsells. Extend six months at a time if fewer than about 40 wins or 10 Tier-1
outcomes, after approval. These counts do not establish statistical adequacy.
Closed-lost rows remain a separate comparison with null customer-quality outcomes.

## Outcome contract

Recommend dimensions from this seller's economics, not from the example contracts.
For each dimension define source, authoritative field, units/currency, customer-age
window, scoring boundaries, missing policy and maturity window. Planned partner
implementation can be a success; distinguish rescue work explicitly. Approval covers
the formula and thresholds before labeling. A known non-activation may be an observed
zero; uncollected activation data stays unavailable. Durability still unobserved
keeps a null observation and an approved neutral contribution, with a provisional
outcome label and outcome_mature=false. Never impute confirmed retention.

The reference engine supports additive dimensions with absolute thresholds.
Percentile rules require frozen development-cohort cutoffs, tie policy, support and
approval in the contract before the engine can use them. Do not change the tier rule
to improve the apparent distribution. Estimated future value stays separate.

## Custom-datapoint discovery

1. Read the seller's product, pricing, documentation and customer use cases. Summarize
   value delivered, users, buyers, target accounts and structural dependencies.
2. Start from audited baseline information: CRM, identity, employees, industry,
   founding year, geography/footprint, business model, functional and relevant-role
   headcounts, company revenue with source/period/type, funding stage and deployed
   technology. LinkedIn and Sales Navigator are optional routes, not prerequisites.
3. Contrast strong and weak **closed-won development** outcomes. Keep reserved test
   accounts hidden. Add operator hypotheses; optional comparable-stage calls can
   expose an attribute to investigate. Cite prospect statements and call dates;
   separate seller pitch and analyst inference. Never send labels to extraction.
4. Propose up to ten custom **account** attributes with mechanisms tied to the seller.
   Rank relevance, detectability, expected coverage, cost and practical value. A
   developer deployment product might consider deployment architecture and engineering
   organization; a retail inventory service might consider operated stores and
   inventory architecture. Neither inherits a champion gate or target_market_size.
5. For every candidate, complete the feature contract: business definition, type,
   units/values, unknown behavior, hypothesis, live source and extraction method,
   historical reconstruction, sufficient/insufficient evidence, coverage estimate,
   cost route, review policy, freshness and extraction version. An agent is the
   extraction method; product docs, filings or dated job descriptions are the sources.
6. Pilot a small contrasting population after cost approval, measure actual coverage,
   review evidence and list exclusions. Current public evidence can support a live
   structural input; mark it current_proxy in historical comparisons. Current employees
   do not imply historical team-composition support. Technology claims distinguish
   familiarity, team usage, pilot, deployed tool and historical usage.
7. Keep only reproducible live features with adequate historical support and cost.
   A feature learned only after engagement is research unless a pre-engagement measure
   reproduces it. CRM-associated contact counts are particularly prone to this leakage.
   Present exact bulk accounts/fields/routes/retries/cap for approval and then apply
   the same contract to all eligible comparison accounts. Cache evidence by account,
   feature/extraction version, source and as_of; retries reuse successful purchases.

Fit measures structural state. Hiring, growth, funding recency, executive changes,
web activity, intent and urgency belong elsewhere. A news article or job post can
still prove a structural fact: classify the measured variable, not the source format.

## Historical evidence and analysis

Prefer opportunity creation; otherwise the earliest defensible pre-close reference,
with close date an accepted documented fallback. Preserve value, as_of, evidence
reference and exact/reconstructed/current_proxy/missing for every value. Keep current
and historical snapshots separately. No undated current data in a validated rule.

`infra/runtime/calibration.py` supplies local label/lift reports, account-grouped
splits and validation metrics. It excludes lost outcomes and proxy evidence, reports
Wilson intervals, all-labeled and mature-only comparisons, missingness and support.
Use one account observation per analysis population; multiple episodes remain linked
in the cohort manifest and must never straddle splits. Duplicate account analysis
rows are rejected to prevent episode-rich accounts dominating the result.

Run raw counts first: group count, Tier-1 count/rate, cohort baseline and rate ratio.
A trait's prevalence among Tier-1 accounts is not lift. Thin groups stay descriptive;
no fixed lift threshold or one success proves a requirement. Odds ratios are not
probability multipliers. Keep policy gates separate from empirical weights.

Reserve account groups before outcome-informed discovery. Fit transformations and
selection within development/training folds. Compare the proposed small rule set to
a current heuristic and the simple all-account baseline. Report top-tier precision,
lift, Tier-1 recall, missed good customers, false positives and uncertainty. Report
mature-only support even if too small to be useful. If all data influenced discovery,
label results exploratory. Repeated test-set tuning turns it into development data.

Only consider regularized fitting when class counts, coverage and actual expanded
parameter counts justify it. Otherwise use descriptive evidence or an explicitly
provisional, approved heuristic. Human review of about ten contrasting accounts
includes errors, thresholds, missing data and partner successes. It complements
quantitative validation. Recalibration requires new versions and review.
