# Calibration and custom evidence

The seller is the Cargo customer; its accounts are the population being evaluated.
Research the seller once and apply one approved definition per datapoint to all
accounts. Calibration is a reviewed project, not a scheduled training job. Keep
customer artifacts in the private customer project.

## 1. Audit the systems and available history

Inspect authorized connections, project context, schemas, and existing models before asking questions.

Locate account and opportunity data, contract or billing data, churn, product usage, support or CSM data, historical enrichment, and any transcripts. Inspect both the CRM and other systems that hold account information.

The audit must identify:

- Stable account IDs, opportunity IDs, domains, and cross-system joins.
- The authoritative source for commercial dates, ARR, churn, and each proposed outcome field.
- Existing custom CRM properties that may already be useful predictors.
- Historical coverage, missingness, conflicting values, duplicates, and impossible dates.
- Available LinkedIn, Sales Navigator, revenue, technographic, public-research, and historical-data capabilities.
- Available recorder integrations or transcript storage. An absent connector is not proof the customer has no recordings; ask about unconnected sources only when useful.

Separate the seller's ARR earned from an account from that account's own company revenue. Keep Revenue, ARR, run-rate, and GMV identifiable rather than silently treating them as equivalent.

Deliver a compact source map and cohort count. Read-only inspection comes first. Any metered extraction or enrichment requires a cost-approved scope.

Deliverable: source map, join keys, quality report and counts. Next checkpoint: approve source conflicts and the proposed outcome/cohort scope under the first two interview topics.

## 2. Approve the customer-specific outcome definition

**The outcome-labeling rubric is a template to design, not a formula to inherit.**

Derive a proposed definition of a great customer from the seller's economics, product, delivery model, and available evidence. Obtain explicit approval before finalizing historical labels.

Possible dimensions include realized revenue, expansion, gross margin, sustained adoption, transaction volume, time-to-value, support burden, implementation effort, or retention. These are examples, not mandatory dimensions.

Do not automatically use Cargo's former `+3 / +2 / -3` rubric, its tier thresholds, or its feature hypotheses. Do not impose SaaS-specific metrics on every seller.

For every selected outcome dimension, define its source, measurement window, scoring rule, boundary conditions, and treatment of unavailable data. Choose absolute tier thresholds or a percentile rule explicitly; do not alternate between them to obtain a desirable distribution.

Use comparable customer-age windows where practical. Keep estimated future lifetime value separate from realized value. Distinguish planned partner implementation from an unplanned rescue; partner delivery is not inherently a bad outcome.

Store `outcome_tier` separately from the later `predicted_fit_tier`. Outcome fields must never enter the fit predictor vector.

**Immature outcomes:** retain recent customers. When the approved rubric uses durability, allow a neutral contribution such as zero while durability remains unobserved. Keep the underlying observation missing and mark `outcome_mature=false`. A customer may still be a provisional Tier 1 through other dimensions.

Report both all-labeled-customer results and a mature-outcomes-only check. If the latter is too small, state that plainly. Never present unobserved retention as confirmed retention.

**Missing is not failed:** a customer known never to have activated may receive an approved zero. A customer whose activation data was not collected has missing evidence. Apply the approved missing-outcome policy rather than inventing a failure.

Deliver the approved outcome contract, its version, and labeled customer cohorts.

Next checkpoint: explicit outcome-contract approval before final labels; cohort scope is reviewed with it.

## 3. Select a practical historical cohort

Start with all initial acquisition opportunities closed within the latest 24 months. Include active and churned closed-won customers. Retain closed-lost opportunities separately for comparison and hypothesis discovery.

After labeling, if there are fewer than roughly 40 closed-won customers or 10 Tier-1 outcomes, propose extending backward in six-month increments, subject to available history and approved cost. These are workflow defaults, not proof of statistical adequacy. Do not block useful descriptive analysis merely because those counts cannot be reached.

Make one optional operator check for a clear historical cutoff after a major business change. If none is known, proceed. Do not build a business-regime detection project.

Use all eligible records in the chosen window. Sampling is for extraction pilots, transcript review, and human QA, not for cherry-picking the analysis population.

The primary customer-quality analysis contains only closed-won acquisition episodes, including churned customers. Closed-lost customer-quality outcomes remain null. Losses are not failed customers. Do not let zero-filled losses inflate apparent feature lift.

Preserve account and acquisition-episode IDs. Exclude renewals and upsells. Group all episodes belonging to the same account together during validation so the same company cannot appear on both sides of a split.

Deliver cohort counts, exclusions, maturity coverage, and the historical date range.

Next checkpoint: approve a backward extension or additional extraction spend if needed; otherwise continue under the approved scope.

## 4. Reconstruct structural attributes at the historical date

Do not expect customers to have stored snapshots. Use available CRM history, warehouse records, dated evidence, and verified historical provider capabilities to reconstruct them.

Default `fit_snapshot_at` to opportunity creation. If unavailable, select the earliest defensible CRM reference before close. Close-date reconstruction is an accepted fallback when that is the usable historical reference. Document the anchor and use it consistently where possible; do not reopen a broad scoring-moment design exercise.

For example, retrieve historical employee or relevant-role counts when the provider actually supports the required date. Do not claim a provider can reconstruct historical team composition merely because it returns current employees.

Each value needs lightweight provenance:

```text
value
as_of
source_or_evidence_reference
snapshot_quality: exact | reconstructed | current_proxy | missing
```

Preserve current enrichment separately from historical reconstruction. A value retrieved today is not automatically a value known at the historical date.

If only current information exists, retain it as `current_proxy` for a clearly marked exploratory comparison. Do not silently use it as historical evidence for a validated rule. Prefer a smaller reliable model over a supposedly precise model built from reconstructed guesses.

Live scoring uses current structural data through the same feature definitions. Historical analysis uses the corresponding historical state.

Deliverable: dated feature inventory and proxy/missingness report. Next checkpoint: feature-contract and pilot approval.

## 5. Establish the standard enrichment baseline

Start with the CRM fields already audited, then supplement them through LinkedIn company enrichment, Sales Navigator, and other verified sources when available.

The baseline candidate pool covers:

| Area          | Candidate information                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| Identity      | Account ID, domain, LinkedIn company identity                                   |
| Firmographics | Employee count, industry, founded year, headquarters, footprint, business model |
| Organization  | Functional headcount, relevant persona counts, team structure                   |
| Economics     | Company revenue with period/type/source, funding stage                          |
| Technology    | CRM, relevant software categories, systems of record, stable architecture       |

This is a baseline enrichment layer, not a requirement to put every available field into the model. Use equivalent authorized sources when LinkedIn or Sales Navigator is unavailable. Do not make one vendor a hard prerequisite.

Preserve raw numerical values. Generate any buckets or transformations in code. Do not discard exact counts or mandate universal ranges before analysis. Every selected transformation must have complete, non-overlapping boundaries and an explicit unknown case.

Relevant roles depend on the seller. RevOps may matter for one seller; engineering, procurement, operations, or store management may matter for another. A person matching a job title is a potential stakeholder, not a confirmed champion or product advocate.

CRM-associated contacts can inform hypotheses. They are not automatically a net-new predictor: engagement during a deal can increase contact counts, and a matching public measure must exist before using that feature operationally.

Deliver the baseline field map, source precedence, and historical coverage.

Next checkpoint: review baseline coverage together with custom candidates in the feature-contract decision.

## 6. Discover customer-specific custom datapoints

Run a seller-specific research step using the [custom-datapoint methodology](references/calibration.md#custom-datapoint-discovery). Understand what the seller sells, its value proposition, target customers, users, buyers, use cases, and conditions under which its product delivers value.

Combine three inputs:

- Existing CRM attributes, seller context, and operator hypotheses.
- Contrasts between stronger and weaker customer outcomes within the development cohort.
- Optional transcript analysis and public or commercial research.

Propose up to ten additional structural features, ranked by relevance, detectability, expected coverage, and practical usefulness. Fewer is acceptable.

Do not automatically add `target_market_size`, `gtm_complexity`, `warehouse_presence`, or Cargo's preferred persona counts to every customer. They are candidate examples. Another seller may need store count, ERP complexity, engineering organization, franchise structure, or regulatory requirements.

Custom features must describe the accounts the seller targets, not repeat the seller's own attributes.

**Calls are optional.** When authorized transcripts exist, inspect comparable call stages across contrasting outcomes. Capture source and call date. Separate what the prospect explicitly said from the agent's hypothesis. Seller pitch language is not evidence of customer need.

Calls can reveal a feature worth measuring. They do not make that feature available before the first call. Retain it only if a provider, public source, approved agent, or existing pre-engagement data can reproduce it for a new account.

**Public research is allowed.** Use product pages, documentation, pricing, news, blogs, changelogs, customer stories, job descriptions, filings, and relevant public technical evidence. The discovery agent generates structural feature hypotheses, not live readiness signals.

Keep outcome labels hidden from the per-account extraction agent. Use only the development cohort for outcome-informed feature discovery when a holdout is reserved.

Deliverable: ranked shortlist and an evidence/source plan, with no outcome labels in extraction requests. Next checkpoint: approve the pilot population, transcript scope and spend cap.

## 7. Test feature feasibility before bulk enrichment

For each baseline or custom feature proposed for scoring, record:

```text
name and business definition
type, values, units, and unknown behavior
hypothesis: why it might predict customer quality
live source and extraction method
historical source and reconstruction method
sufficient and insufficient evidence
expected coverage and cost
confidence or review policy
refresh policy and extraction version
```

Distinguish verified capabilities from merely suggested providers. An agent is an extraction method, not an evidence source; name the underlying data it will inspect.

Technology evidence must distinguish individual familiarity, team usage, pilot, deployed tool, and historical usage when those distinctions affect the feature. A keyword in one job requirement does not establish company-wide adoption.

Select a small, cost-approved pilot across stronger, weaker, churned, and where useful lost accounts. Measure actual extraction coverage and review the evidence. Never infer coverage solely from the model's confidence statement.

Promote a feature only when it has a stable definition, reproducible live extraction, acceptable historical support, and acceptable cost. Mark retrospective-only ideas as research findings rather than forcing them into the live score.

Present the complete contract, pilot results, excluded candidates, exact bulk population, and live cost estimate. Obtain approval, then enrich all comparison accounts using that same contract. Cache successful evidence so retries do not purchase it again unnecessarily.

Deliverable: reproducible extraction contract, reviewed pilot and exact bulk budget. Next checkpoint: explicit approval before bulk purchases.

## 8. Analyze, propose rules, and validate

Begin with counts and lift tables. For each feature value report account count, Tier-1 count and rate, baseline rate, lift, missingness, and maturity mix. Show uncertainty when support is small. Lift means the group's Tier-1 rate divided by the stated cohort baseline, not how common a trait is among Tier-1 customers.

No fixed lift threshold makes a result reliable. One successful account is not a structural requirement. Do not convert an odds ratio into a probability multiplier.

Test only a few approved interactions with a plausible mechanism and sufficient observations. Keep raw metrics and narrative hypotheses available for review, but exclude outcome fields from predictors.

Use descriptive analysis for thin data. Consider a constrained regularized model only when class counts, feature complexity, and coverage justify it. Count actual fitted parameters, including category expansions and interactions. Do not add a second model merely to look sophisticated.

Aim for a small rule set, often three to eight useful attributes rather than a mandatory quota. Retain policy exclusions separately from empirically supported weights. Do not invent universal disqualifiers such as a minimum of two champions.

Validate with account-grouped holdout data when feasible, or suitable resampling for smaller datasets. Perform preprocessing and fitted feature selection within the training process. If all data informed discovery, call the result exploratory rather than held-out validation.

Report top-tier precision and lift, Tier-1 recall, missed good customers, false positives, support size, and the mature-only comparison. Compare with the current customer heuristic or a simple baseline.

Have the operator review approximately ten contrasting accounts, including errors, boundaries, missing data, and partner-delivered successes where relevant. Human agreement does not replace quantitative validation. Repeatedly tuning on a test set makes it development data.

Weights and tier boundaries are proposals requiring approval. A 0-100 fit score is a prioritization index, not a calibrated probability of purchase or success.

Deliverable: support/lift tables, validation report, error review and proposed rule set. Next checkpoint: approve the model and operating contract.

## 9. Publish one scoring contract and one scorer

Use the existing project-root context location; do not declare another workspace context singleton.

Publish:

```text
context/account-fit-feature-contract.yaml
context/account-fit-scoring.yaml
context/account-fit-scoring.md
```

The feature contract defines the approved inputs and extraction rules. The scoring contract contains the customer-specific outcome definition and version, model evidence, feature version, gates, weights or coefficients, interactions, rounding, missing-data handling, score range, thresholds, and approval state.

Generate Markdown from those contracts. Keep approved versions immutable and preserve the previous version for rollback. Do not let an unapproved draft become the active scorer.

Ship one Python scoring implementation. It validates normalized input, applies the approved contract, and returns:

```text
scoring_status: scored | insufficient_data | error
score: number or null
tier: configured tier or null
scoring_version
feature_contract_version
feature_snapshot_at
applied_gates
rule_contributions
missing_features
data_quality_notes
```

Missing evidence is not automatically zero fit. Missing critical inputs produce `insufficient_data`; optional missing inputs follow the explicit approved policy. Any confidence or coverage label is rule-based and describes evidence quality, not invented model certainty.

The action accepts normalized features and an approved contract reference, not arbitrary weights or formulas supplied by the LLM. Validate typed input and output schemas, including nullable values for insufficient data; malformed responses must not reach CRM writeback.

Verify the actual Cargo Python execution mechanism, dependencies, contract access, packaging, and output shape in the test environment. Do not assume an ordinary agent has a filesystem or Python interpreter. If that mechanism cannot be confirmed, report the blocker instead of silently reverting to LLM arithmetic.

Deliverable: immutable approved contracts, generated Markdown and tested scorer bundle. Next checkpoint: review the disabled plan; deployment remains separately gated.

## 10. Run the standing account-scoring pipeline

The shipped live flow reads CRM fields and the custom evidence cache; it has no
automatic custom discovery or refresh step. The installing agent must implement and
verify each approved cache-population route before activation. Missing critical
evidence stops scoring. The live flow is:

```text
Eligible CRM account
-> read current CRM fields and installer-populated custom evidence cache
-> persist normalized feature snapshot
-> deterministic Python action computes score and tier
-> agent reads generated context and explains the trusted result
-> workflow persists trusted score, tier, rationale, version, and timestamp
```

Give the agent read-only evidence access and access to the scoring action. CRM writes belong to the workflow. The scorer agent must have the deterministic action available and cannot change its score. The workflow must persist the trusted computation result, not an independently generated number in the agent's prose. If the runtime cannot expose an agent tool result safely, compute through the same Python action in the workflow and pass that result to the agent for explanation. There remains only one implementation of the score math.

Repeated runs on the same feature snapshot and contract version must yield identical score and tier. Refreshing or reclassifying features is a separate, versioned operation.

Run on the CRM account extract and match its CRM record ID. Reuse existing approved score properties where possible. Proposed extra version or status fields require live type checks and mapping approval.

Score newly eligible and stale accounts under the approved cadence. A new approved scoring version must trigger a controlled backfill even for recently scored records. Keep the per-sweep limit (25 by default), apply an exact approved pilot ID filter before enabling, then review the priced bulk scope separately. Three consecutive attempts per version exhaust the retry allowance; investigate and explicitly reset it after repairing the cause. Success resets the counter. Verify the trigger mechanism rather than assuming an `added` event catches version changes or previously present rows.

Avoid recursive scoring from the pipeline's own score writes. Stamp success only after a real successful write. Preserve the last valid score on runtime failure and expose the failure separately.

Keep the first play disabled with concurrency protection where supported. Do not automatically retrain, overwrite manual fields outside scope, enroll outreach, or route leads to reps.

Deliverable: disabled resource plan, graph, cost preview and runtime verification checklist. Next checkpoint: named test deployment approval, then paid pilot approval, then cadence activation after live acceptance. Calibration-only requests stop at the approved artifacts without deployment.

## Run the local analysis

Discovery and feature selection are procedures performed by the installing agent and
reviewed by the operator. The Python helper does not discover attributes, fetch
historical data, fit weights or approve rules. The two synthetic sellers demonstrate
scorer portability across hand-authored contracts, not automated discovery.

`infra/runtime/calibration.py` labels outcomes, computes predictions with the exact
`score()` used live, and produces lift and validation metrics. Its private JSON input
contains `feature_contract`, `contract`, `feature_names`, `episodes`, `analysis_mode`
(`exploratory` or `holdout`) and, for holdout, `discovery_scope: development`.
The supplied engine supports additive outcomes with absolute thresholds. To use a
percentile rubric, freeze its development-cohort cutoffs, support and tie policy as
approved absolute boundaries first. Both contracts must already be approved and
non-synthetic. Each episode carries
account_id, episode_id, kind, stage, age_days, observations, fit_snapshot_at and a
normalized `snapshot` with that same account ID and snapshot_at. Assign each account
to one split before discovery. Historical snapshot dates and evidence must reflect
the selected pre-close anchor. Caller-supplied `predicted_fit_tier` is ignored.

```sh
python3 infra/account-scoring/runtime/calibration.py /private/path/calibration.json
```

Use one documented account observation per analysis population; duplicate accounts
are rejected to prevent episode-rich accounts dominating the result. The report
includes each Python result, support, Wilson intervals, missingness, all-labeled and
mature-only comparisons, precision/lift/recall, errors and the all-account baseline.
Use the same frozen numeric bands as scoring; the helper applies their inclusive
lower and exclusive upper boundaries without altering the stored raw values. The
standalone `lift_table` accepts optional reviewed `bands`; without them it reports
raw-value groups. Missing, stale cached and current-proxy evidence remain a separate null group.
Candidate discovery outside a frozen contract is a separate development analysis.

A dimension with neutral missing policy can contribute approved points while its
observation remains unavailable. Such an outcome stays provisional, with
`outcome_mature=false`, until all required observations and age windows are satisfied;
it may never enter the mature-only population. Report that population's size plainly.
