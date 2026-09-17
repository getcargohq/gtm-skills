# Acceptance

## Offline repository evidence

- Run `node --import tsx account-scoring/evals/contract.mjs` from the repository.
  It checks compiled resource and graph boundaries, executes compiled guards with
  synthetic node outputs, runs the exact packaged Python script locally and tests
  the installer file plan. A changed graph slug must fail these evaluations.
- Run `python3 -m unittest discover -s account-scoring/evals -p 'test_*.py'`.
  Test every boundary/category, gates, interactions, missingness, determinism,
  immature outcomes, lost null labels, grouped splits, reviewed numeric bands,
  scorer-derived historical predictions, cache migration and provenance handling.
- Run `node account-scoring/scripts/build.mjs --check`; generated Markdown and Python
  source strings must match canonical contracts. No independent copy of score math.
- Two synthetic sellers have different products, feature shortlists and outcome
  definitions and use the same scorer. This verifies scorer portability across
  hand-authored contracts; it does not verify discovery or shortlist relevance.
- `cargo-ai cdk types`, `check` and `plan` pass; generated schemas never enter git.
  Repository validation, typecheck, formatting and routing corpus checks pass.

## Customer calibration acceptance

- Audit joins, source authority, cohort counts, conflicts, exclusions and impossible dates.
- Explicitly approve the outcome rubric and measurement/missingness/maturity policy.
  Mature, provisional, unavailable and observed failed outcomes remain distinguishable.
- Include every eligible acquisition win, churn included; keep losses with null quality
  labels. Preserve account/episode IDs and account-group validation splits.
- Reconstruct historical structural inputs with provenance. Proxies remain exploratory.
- Seller research produces a relevant custom shortlist alongside the common baseline.
  Pilot coverage is measured with evidence review before bulk cost approval.
- Evidence-only extraction receives no labels or test-set outcome hints. Discovery,
  transformations and fitting respect the held-out account boundary.
- Report counts, uncertainty, missingness, maturity, lift, precision/recall, missed good
  accounts, false positives and baseline comparison. Report a thin mature-only set plainly.
- Review about ten contrasting cases and approve a small rule set, policy gates,
  thresholds and missingness. Score is an index, not a calibrated probability.
- Publish immutable feature/outcome/scoring versions, generate Markdown and approve
  CRM mappings and cadence. A contract draft cannot become active through a prompt edit.

## Named test workspace only, after separate approval

These remain unchecked until supported by run links and readback evidence.

- [ ] Confirm a non-production workspace and authorized connectors/model availability.
- [ ] Inspect exact extractor ID/field types and CRM output properties; approve mappings.
- [ ] Deploy the first play disabled, with protected concurrency and exact pilot scope.
- [ ] Approve fresh priced source/enrichment/action costs, retries and spend cap.
- [ ] Execute native Python in Cargo and confirm dependencies, inputs and output shape.
- [ ] Score one eligible CRM account and read back the correct ID, score/tier/rationale.
- [ ] Missing critical data returns insufficient_data without replacing the valid score.
- [ ] Malformed outputs, empty/mismatched writes and runtime errors cannot stamp success.
- [ ] Late write failures exhaust the retry cap; prior successful evidence survives.
- [ ] Custom-column attempt counters persist through source syncs and reach the next run.
- [ ] Pre-existing pilot rows, stale rows and changed versions run within the batch limit.
- [ ] Fresh rows stay excluded after the pipeline's own writes; no recursive scoring.
- [ ] Every tier segment consumes the actual CRM output and reconciles after refresh.
- [ ] Cache hits avoid repeat purchases and custom refresh routes honor the approved cost.
- [ ] Only after acceptance and cadence approval, enable the intended recurring scope.

## Handoff

Include PR and plan diff, runtime status, the four interview topics, workflow defaults,
approved contracts (or none), checks and unresolved verification, scoped price preview,
blocker owner and explicit deployment state. Never commit customer rows, identities,
transcripts or credentials as public evidence. No production deployment is in scope.
