---
name: account-scoring
description: 'Calibrate a customer-specific account fit model from historical customer outcomes and keep eligible CRM accounts scored by deterministic Python with agent explanations. Triggers: "calibrate our account scoring", "keep our accounts scored as they arrive", "re-score after an approved model change", "calibrate our ICP from customer outcomes", "why is this account tier A", "our lead scoring is a spreadsheet nobody trusts". Cargo CDK, Python, HubSpot, Salesforce, Attio. Skip when: qualify a supplied list once, which is score-leads; source a new universe, which is tam-building. Calibration-only requests stay here and end before live activation.'
version: "0.3.0"
compatibility: "Requires cargo-cdk bootstrap (cargo-project on current bundles), Cargo CLI and CDK with native Python support, and Python 3.9+ locally. Checked offline with CLI 1.0.96 and CDK 1.0.81. HubSpot and OpenAI bind authorized connections. Runtime and customer field mappings require verification in a confirmed non-production workspace."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/account-scoring
metadata:
  author: getcargo
  source: cookbook
  openclaw:
    requires:
      bins:
        - cargo-ai
    install:
      - kind: node
        package: "@cargo-ai/cli@latest"
        bins:
          - cargo-ai
    homepage: https://github.com/getcargohq/gtm-skills
---

# Account scoring

**State: to-be-approved.** Runtime verification is pending. Shipped contracts are synthetic drafts and cannot score live accounts. The first play is disabled; deployment and paid execution require separate approval.

## The outcome

The customer gets a repeatable account-fit pipeline built from two layers of evidence:

**Baseline enrichment:** existing CRM attributes plus reliable company, LinkedIn, Sales Navigator, organizational, financial, and technographic data.

**Customer-specific enrichment:** custom structural datapoints derived from that seller's product, market, historical outcomes, operator hypotheses, and optional call transcripts.

Historical analysis establishes candidate scoring rules. An approved, versioned contract controls live scoring. Every score is traceable to normalized inputs and applied rules.

### Keep fit separate from readiness

Fit describes the company's structural characteristics. Readiness describes recent events, momentum, and engagement.

| Fit input                | Separate readiness input    |
| ------------------------ | --------------------------- |
| Employee count           | Employee growth             |
| Relevant operator count  | Recent operator hire        |
| Funding stage            | Recent funding round        |
| Current GTM architecture | Recent tooling migration    |
| GTM motion               | Launching a new motion      |
| Geographic footprint     | Recent geographic expansion |

Do not use hiring acceleration, recent funding, executive changes, website activity, product intent, or news-based urgency in this fit model.

A news article, job description, or changelog can still be **evidence for a structural attribute**. The source format does not determine whether the feature is fit or readiness. What the feature measures does.

Customer-quality outcomes, predicted account fit, readiness, and partner-delivery recommendations must remain distinct. This V1 does not build expansion, renewal, conversion, intent, or prioritization models.

## Put it in your project

This is a worked pipeline. The installing agent performs the audit, proposes contracts, adapts the resources, and presents the plan.

**Install the required authoring skill first.** If `cargo-cdk` is absent:

```sh
npx skills add getcargohq/cargo-skills --skill cargo-cdk
```

Read `.agents/skills/cargo-cdk/SKILL.md` and complete its bootstrap. Current bundles redirect it to `cargo-project`; follow that redirect. If neither can be read, stop before template work.

1. Inside a CDK project, run `cargo-ai cdk add cookbook/account-scoring`. With no project, use `cargo-ai cdk init <dir> --cookbook account-scoring`, enter it, then `npm install`. The current CLI also calls this namespace `project`. Never use `init --force` in a non-empty directory. **Reading this in the project's installed skill directory means installation already happened; start at reconciliation.**
2. Reconcile accounts, connectors and folders with existing declarations. Reuse the CRM account extract and its stable record ID. This example's resources are isolated for installation; the customer project should not deploy duplicates. Keep the project's root context singleton. Copy `infra/account-scoring/context/` contracts into that existing root context location; replace the synthetic drafts after calibration.
3. Read [calibration and discovery](references/calibration.md), [runtime and installation](references/runtime.md), and [acceptance](evals/acceptance.md). Existing authorized connectors use `default: true`. No secret is needed by this example. A new connector credential uses `workspaceEnv`; `secret()` is only for an explicitly deploy-supplied value, never `env()`.
4. Follow the phases below. Install build dependencies with `npm install --prefix scripts/account-scoring`. After approval, build assets from the canonical root contracts with `node scripts/account-scoring/build.mjs --infra infra/account-scoring --context context --approved`. Review the generated context, immutable contract archive and version backfill together. The Python source is embedded in the native action; it does not read a local path at runtime.
5. Run the contract evaluation from the installed skill directory with `ACCOUNT_SCORING_INFRA` set to the absolute `infra/account-scoring` path and `ACCOUNT_SCORING_CONTEXT` to the canonical root context directory. Run `cargo-ai cdk types`, `cargo-ai cdk check`, and `cargo-ai cdk plan`. **Stop after plan.** A named non-production deployment and any metered pilot need separate explicit approval. No approval is implied by a green plan.

Reconcile connectors, models, folders, and root context first. Then execute the following phases. Each phase ends with its deliverable and the next approval checkpoint. Do not ask the operator to assemble the workflow themselves.

### 1. Audit the systems and available history

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

### 2. Approve the customer-specific outcome definition

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

### 3. Select a practical historical cohort

Start with all initial acquisition opportunities closed within the latest 24 months. Include active and churned closed-won customers. Retain closed-lost opportunities separately for comparison and hypothesis discovery.

After labeling, if there are fewer than roughly 40 closed-won customers or 10 Tier-1 outcomes, propose extending backward in six-month increments, subject to available history and approved cost. These are workflow defaults, not proof of statistical adequacy. Do not block useful descriptive analysis merely because those counts cannot be reached.

Make one optional operator check for a clear historical cutoff after a major business change. If none is known, proceed. Do not build a business-regime detection project.

Use all eligible records in the chosen window. Sampling is for extraction pilots, transcript review, and human QA, not for cherry-picking the analysis population.

The primary customer-quality analysis contains only closed-won acquisition episodes, including churned customers. Closed-lost customer-quality outcomes remain null. Losses are not failed customers. Do not let zero-filled losses inflate apparent feature lift.

Preserve account and acquisition-episode IDs. Exclude renewals and upsells. Group all episodes belonging to the same account together during validation so the same company cannot appear on both sides of a split.

Deliver cohort counts, exclusions, maturity coverage, and the historical date range.

Next checkpoint: approve a backward extension or additional extraction spend if needed; otherwise continue under the approved scope.

### 4. Reconstruct structural attributes at the historical date

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

### 5. Establish the standard enrichment baseline

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

### 6. Discover customer-specific custom datapoints

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

### 7. Test feature feasibility before bulk enrichment

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

### 8. Analyze, propose rules, and validate

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

### 9. Publish one scoring contract and one scorer

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

### 10. Run the standing account-scoring pipeline

The live flow is:

```text
Eligible CRM account
-> retrieve or refresh approved feature evidence
-> persist normalized feature snapshot
-> scoring agent reads generated scoring context
-> deterministic Python action computes score and tier
-> agent explains applied rules and evidence
-> workflow persists trusted score, tier, rationale, version, and timestamp
```

Give the agent read-only evidence access and access to the scoring action. CRM writes belong to the workflow. The scorer agent must have the deterministic action available and cannot change its score. The workflow must persist the trusted computation result, not an independently generated number in the agent's prose. If the runtime cannot expose an agent tool result safely, compute through the same Python action in the workflow and pass that result to the agent for explanation. There remains only one implementation of the score math.

Repeated runs on the same feature snapshot and contract version must yield identical score and tier. Refreshing or reclassifying features is a separate, versioned operation.

Run on the CRM account extract and match its CRM record ID. Reuse existing approved score properties where possible. Proposed extra version or status fields require live type checks and mapping approval.

Score newly eligible and stale accounts under the approved cadence. A new approved scoring version must trigger a controlled backfill even for recently scored records. Verify the trigger mechanism rather than assuming an `added` event catches version changes or previously present rows.

Avoid recursive scoring from the pipeline's own score writes. Stamp success only after a real successful write. Preserve the last valid score on runtime failure and expose the failure separately.

Keep the first play disabled with concurrency protection where supported. Do not automatically retrain, overwrite manual fields outside scope, enroll outreach, or route leads to reps.

Deliverable: disabled resource plan, graph, cost preview and runtime verification checklist. Next checkpoint: named test deployment approval, then paid pilot approval, then cadence activation after live acceptance. Calibration-only requests stop at the approved artifacts without deployment.

## What you will be asked

Derive systems, schemas, costs, current context, and counts before asking. Limit the interview to four decision topics; explicit spend and deployment authorizations remain mandatory checkpoints.

| Input                 | Kind                       | Ask only what the audit cannot answer                                                                                                      | Why                                                                                  |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `Sources and access`  | asked after audit          | Confirm authoritative conflicts and useful unconnected outcome or transcript sources.                                                      | Wrong source authority or missing access changes the labels and historical coverage. |
| `Success and cohort`  | asked after proposal       | Approve the customer-specific outcome rubric, maturity handling, historical window, practical snapshot anchor and optional obvious cutoff. | Comparable customer outcomes determine what the fit model predicts.                  |
| `Feature contract`    | asked after pilot proposal | Add human hypotheses; approve baseline plus custom features, transcript use and the pilot, then the exact bulk scope and cost.             | Reproducibility, historical support and spend must be established before scaling.    |
| `Model and operation` | asked after validation     | Review validation and approve rules, gates, missingness, thresholds, writeback fields and cadence.                                         | These decisions control every live score and the recurring workload.                 |

Do not ask the operator to design attributes from scratch, name API fields from memory, or decide on a statistical method without a recommendation.

## What you can change

Offer relevant variations with their tradeoffs:

| Variation                                         | When                                                        | How                                                                            | Consequence                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `Different outcome metrics or horizon`            | Seller economics or observation windows change.             | Approve a revised outcome contract, relabel and recalibrate.                   | A live prompt edit cannot update the model; analysis and validation repeat. |
| `Alternative authorized baseline provider`        | The preferred source is unavailable or poorly covered.      | Match historical and live field definitions to a verified equivalent source.   | Recheck coverage, extraction methods and current prices.                    |
| `No transcripts`                                  | Recordings are absent or not authorized.                    | Use CRM, operator hypotheses, public research and providers.                   | Less call evidence for discovery; the base pipeline still works.            |
| `Agent-researched custom attributes`              | Approved public evidence can fill a structural feature gap. | Add an evidence-only extraction route under the same feature contract.         | More evidence review, cost and extraction uncertainty.                      |
| `Sparse historical data`                          | Cohort or class counts cannot support validation.           | Publish descriptive findings or an explicitly provisional approved heuristic.  | Uncertainty remains visible; do not fabricate validation.                   |
| `Model-only output instead of CRM`                | The customer approves a storage-only consumer.              | Replace CRM writes with approved storage and remove the unused CRM write path. | Removes CRM visibility and requires storage acceptance checks.              |
| `Different score presentation or rescore cadence` | Users need another scale or refresh interval.               | Update thresholds, schemas, eligibility and operating contract together.       | Revalidate boundary mappings and the recurring cost.                        |

Separate conversion, expansion, readiness, and partner-routing models are out of V1 scope. Store relevant diagnostics without building extra scoring engines.

## What should not change

- **Customer-specific definitions.** Reusing Cargo's outcome formula or custom features would make other customers inherit Cargo's assumptions.
- **Outcome versus predictor separation.** Scoring success from its own usage or retention label produces circular results.
- **Comparable cohorts.** Treating lost deals as failed customers corrupts customer-quality lift.
- **Historical provenance.** Current enrichment silently substituted for history creates misleading rules.
- **Same feature contract across accounts.** Changing a feature's meaning by account makes comparisons invalid.
- **Measurable custom attributes.** A useful retrospective observation that cannot be computed for new accounts is not a live scoring feature.
- **Persisted features and deterministic math.** Reinterpreting inputs or weights on each run defeats repeatability.
- **Trusted numeric writeback.** An agent must not rewrite a tool's score before persistence.
- **Approved versions only.** Automatic model changes would silently change the meaning of every tier.
- **CRM identity and field types.** Wrong IDs or types can make a successful-looking run write nothing or the wrong value.
- **Explicit permissions and privacy.** Do not commit customer rows, call transcripts, credentials, or identifying customer names to the public repository.

Record approved methodological deviations under `## Decisions`, with their consequences. Access, spend, deployment, and privacy restrictions are not optional methodological preferences.

## Done when

### Contract and offline acceptance

- [ ] The audit reconciles cohort counts and source authority.
- [ ] Outcome labeling is explicitly customer-specific; illustrative numbers are not active defaults.
- [ ] Mature, provisional, unavailable, and failed outcomes are distinguishable.
- [ ] Closed-lost customer-quality labels remain null.
- [ ] Standard enrichment and seller-specific custom discovery both work.
- [ ] Two synthetic sellers with different products generate different relevant feature shortlists; no universal `target_market_size` or champion gate appears.
- [ ] Historical and live extraction use the same definitions; proxies and missingness are visible.
- [ ] The feature pilot, coverage report, and cost approval precede bulk enrichment.
- [ ] Validation reports support sizes, uncertainty, and limitations, not only a top-lift ranking.
- [ ] The same scorer implementation works with two different approved synthetic outcome and scoring contracts.
- [ ] Every threshold boundary, unknown value, gate, interaction, and score total passes deterministic tests.
- [ ] Repeated input and contract versions return identical numeric results.
- [ ] Contradictory agent prose cannot change persisted score or tier.
- [ ] Generated Markdown matches the canonical contracts.

### Live acceptance after explicit test approval

- [ ] The Python action executes successfully through the actual Cargo runtime.
- [ ] An eligible CRM account receives the correct computed score and rationale at the audited record ID.
- [ ] Missing critical data does not become a low-fit score.
- [ ] Failed writes do not receive successful scoring timestamps.
- [ ] Stale accounts, changed approved versions, and previously present pilot rows are correctly reprocessed.
- [ ] All configured tier segments consume output fields and cover their intended tiers.
- [ ] The first deployment is disabled and cannot trigger unapproved enrichment or CRM writes.

### Repository checks and handoff

Update existing entries, rather than duplicating them, in `skills.sh.json`, `hooks/skill-loads.sh`, the root README pipeline table, and `.github/data/approvals.json`. Keep the approval state honest and do not fabricate or erase genuine prior evidence.

Add routing cases: a request to calibrate and continuously score accounts reaches `account-scoring`; a request to qualify a supplied list once reaches the existing one-off sibling. Include the calibration-only seam using current routing conventions rather than inventing another root skill.

Run:

```bash
node scripts/build-catalog.mjs
node scripts/generate-llms-txt.ts
npm run typecheck
npm run validate
npm run format:check
```

Run the skill's contract evaluation, deterministic Python tests, and the current Cargo type/check/plan commands. Confirm workflow-body behavior, filter types, null handling, resource packaging, and exact connector inputs. A green plan is not evidence of runtime success.

Stop after plan and present the diff. Live deployment and paid pilot execution each require explicit approval for the named test workspace and exact scope. Never deploy to production.

For repository contributions, if blocked, open the PR with the blocker in its title and at the top of its description: exact error, file and line, tested versions, and smallest required fix. Do not label blocked behavior as verified.

Hand back: PR link; one-sentence runtime summary; the four interview topics; defaults and approved contracts; checks passed; behavior not verified; cost preview; plan diff; blockers and who can clear them; and an accurate statement of deployment state.

## What it costs

Fetch current prices immediately before each paid preview. Never hard-code credit amounts in pipeline Markdown.

Separate source extraction, baseline enrichment, historical reconstruction, custom research, optional transcript processing, and recurring scoring costs. Show the exact accounts, fields, routes, retry allowance, and maximum authorized spend for the pilot and bulk run separately.

Check caching and historical coverage before purchasing more data. Explain any provider limit or unverified historical capability. Local Python computation is not a provider-enrichment fee; hosted compute or action charges, if applicable, must still be measured.

## Composes into

The approved fit outputs can feed existing TAM, contact-sourcing, CRM segmentation, routing, and rep workflows. Readiness and pain-alignment agents remain independent consumers or sibling processes. A later prioritization layer may combine their outputs.

Reuse resources inside the customer project where appropriate, while keeping the repository example independently installable. Do not create additional integrations, agents, segments, or folders unless the implemented outcome actually needs them.

**Final design:** common baseline enrichment, customer-specific measurable datapoints, customer-specific outcome labeling, evidence-backed calibration, and one deterministic scoring contract applied consistently to every account.
