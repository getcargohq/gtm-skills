---
name: account-scoring
description: 'Calibrate a customer-specific account fit model from historical customer outcomes and keep eligible CRM accounts scored by deterministic Python with agent explanations. Triggers: "calibrate our account scoring", "keep our accounts scored as they arrive", "re-score after an approved model change", "calibrate our ICP from customer outcomes", "why is this account tier A", "our lead scoring is a spreadsheet nobody trusts". Cargo CDK, Python, HubSpot, Salesforce, Attio. Skip when: qualify a supplied list once, which is score-leads; source a new universe, which is tam-building. Calibration-only requests stay here and end before live activation.'
version: "0.3.1"
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
4. Follow the linked calibration phases. Install build dependencies with `npm install --prefix scripts/account-scoring`. After approval, build assets from the canonical root contracts with `node scripts/account-scoring/build.mjs --infra infra/account-scoring --context context --approved`. Review the generated context, immutable contract archive and version backfill together. The Python source is embedded in the native action; it does not read a local path at runtime.
5. Run the contract evaluation from the installed skill directory with `ACCOUNT_SCORING_INFRA` set to the absolute `infra/account-scoring` path and `ACCOUNT_SCORING_CONTEXT` to the canonical root context directory. Run `cargo-ai cdk types`, `cargo-ai cdk check`, and `cargo-ai cdk plan`. **Stop after plan.** A named non-production deployment and any metered pilot need separate explicit approval. No approval is implied by a green plan.

The installing agent carries out the [ten calibration phases](references/calibration.md):
audit sources, approve outcomes, select the cohort, reconstruct history, establish the
baseline, discover custom attributes, pilot extraction, validate rules, publish the
contracts, then prepare the disabled live flow. Each phase names its deliverable and
approval checkpoint. Discovery is an agent-led procedure, not an automated training job.

The shipped play reads CRM fields plus a cache the installer must populate through
approved extraction routes. It does not refresh custom evidence itself. See
[runtime requirements](references/runtime.md#feature-retrieval-and-refresh) before
promising a working customer installation.

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
- [ ] Customer baseline and custom extraction routes are implemented, priced and verified; discovery produces a reviewed shortlist.
- [ ] Two synthetic seller contracts produce their expected scores through the same engine. Customer-specific discovery and shortlist relevance are reviewed separately.
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

Use the full [acceptance checklist](evals/acceptance.md) to separate offline evidence
from live verification. Hand back the proposed contracts, plan diff, scoped cost
preview, checks, unresolved mappings and deployment state. Calibration-only work
ends with reviewed artifacts; it does not require activation.

## What it costs

Fetch current prices immediately before each paid preview. Never hard-code credit amounts in pipeline Markdown.

Separate source extraction, baseline enrichment, historical reconstruction, custom research, optional transcript processing, and recurring scoring costs. Show the exact accounts, fields, routes, retry allowance, and maximum authorized spend for the pilot and bulk run separately.

Check caching and historical coverage before purchasing more data. Explain any provider limit or unverified historical capability. Local Python computation is not a provider-enrichment fee; hosted compute or action charges, if applicable, must still be measured.

## Composes into

The approved fit outputs can feed existing TAM, contact-sourcing, CRM segmentation, routing, and rep workflows. Readiness and pain-alignment agents remain independent consumers or sibling processes. A later prioritization layer may combine their outputs.

Reuse resources inside the customer project where appropriate, while keeping the repository example independently installable. Do not create additional integrations, agents, segments, or folders unless the implemented outcome actually needs them.

**Final design:** common baseline enrichment, customer-specific measurable datapoints, customer-specific outcome labeling, evidence-backed calibration, and one deterministic scoring contract applied consistently to every account.
