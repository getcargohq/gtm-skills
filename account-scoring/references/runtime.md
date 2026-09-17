# Runtime, packaging and operation

## Verification boundary

Checked on 2026-09-16: Cargo CLI 1.0.96, CDK 1.0.81 and its installed workflow SDK.
A read-only connector model lookup lists `gpt-4o`; recheck availability in the
chosen test workspace.
`orchestration action list python` resolves native `python`; read-only output-schema
lookup returns an object with `result`. SDK `python({script})` emits that action.
The platform implementation `apps/backend/src/domains/connection/services/nativeIntegration/actions/python.ts`
and `apps/backend/src/utils/python.ts` wraps the script in an async function, converts
`nodes` to Python dictionaries, loads imports with Pyodide and wraps its returned value
as `{result}`. The scorer uses only the Python standard library.

The native integration is not a connector: `connection integration get native`
returns `integrationNotFound`. The supported metadata command is
`cargo-ai connection native-integration get`. Use that or action discovery and
get-output-schema, never
invent a `native` connector. HubSpot `fetchRecords`, `updateRecords` and `getRecord`
inputs were checked through current CLI output and generated types. An update returns
an array; the schema of an individual returned record is dynamic. The readback guard
expects HubSpot's raw `id` and `properties` shape and needs a test-workspace check.

**Not verified:** native action execution on the service, Pyodide version/import
behavior there, connector response and property types in a confirmed test workspace,
current LLM model availability, extract refresh behavior and live scheduling. A local
Python run, generated types or green plan does not verify those behaviors. Do not run
this template on the currently logged-in workspace just because authentication works.

## Installation and canonical artifacts

CDK's `planFiles` copies all `infra/` assets, including Python and YAML, to
`infra/account-scoring/`; `scripts/` moves to `scripts/account-scoring/`; references,
evaluations and fixtures stay beside the installed skill. `scripts/package.json`
prevents the loader from executing build scripts as CDK resources.

Copy the two draft YAML files into the existing project-root context. The build parses YAML and embeds JSON literals for standard-library Python.
These fixtures describe a fictional seller. They are not an outcome formula or
feature shortlist for the customer. Both contract approval states must be approved,
with references, and `synthetic` false before live use.

Install the build dependencies with `npm install --prefix scripts/account-scoring`.
After approval, build with:

```sh
node scripts/account-scoring/build.mjs --infra infra/account-scoring --context context --approved
```

The build embeds the exact Python source and canonical contract objects in
`infra/account-scoring/runtime/generated.ts`. Markdown is generated into the same
context directory from those objects and passed to the explanation agent. No remote
file lookup, checkout, shell or interpreter in the ordinary agent is assumed.
Every build with approved, non-synthetic contracts enforces the immutable archive,
even without `--approved`; that flag additionally rejects draft inputs. Approved versions are archived; changing the content of an existing approved version
must fail. Preserve the old bundle and contracts for rollback, and redeploy a reviewed
bundle only after plan approval. Editing prose does not activate a model.

Run offline checks from the installed skill directory:

```sh
ACCOUNT_SCORING_INFRA=/absolute/project/infra/account-scoring \
  ACCOUNT_SCORING_CONTEXT=/absolute/project/context \
  node --import tsx evals/contract.mjs
ACCOUNT_SCORING_INFRA=/absolute/project/infra/account-scoring \
  python3 -m unittest discover -s evals -p 'test_*.py'
cargo-ai cdk types
cargo-ai cdk check
cargo-ai cdk plan
```

Run the build's `--check` from the project with the same `--infra` and `--context`
arguments. Review the graph alongside the plan. The test runner needs the project's
CDK, zod and tsx modules. Adapt the compiled-graph fixture expectations alongside
customer feature/CRM mappings; the generic Python fixture tests remain unchanged. Never copy workspace type dumps or customer rows into the
public repository.

## Feature retrieval and refresh

The worked implementation supports audited CRM properties and previously collected
custom evidence. `normalize` maps the contract's `live_extract` routes: `crm` reads
an explicitly mapped property from the current extract; `cached_evidence` reads the
account's installer-populated custom `fit_evidence` JSON. The cache has account_id,
feature_contract_version and a features map. Each feature has value, as_of,
source_or_evidence_reference, snapshot_quality and extraction_version. Missing values
have value/as_of null and quality missing. Counts stay numerical; only Python applies bands.

CRM observations are dated at normalization time. This means "read from the current
extract", not "the company verified this count today". Never use hs_lastmodifieddate
as a feature observation date: unrelated updates and this play's own writes change
it. Verify extract freshness before enabling; the play cannot detect a stale source
sync. refresh_days applies only to cached custom evidence. For historical analysis,
use actual property history with its original provenance, not today's CRM extract.
Current public evidence is exact only in a current snapshot; historical substitutions
are current_proxy and cannot support validated scoring.

Cache contract-version changes discard cached features with a data_quality_notes
explanation. Per-feature extraction-version drift or invalid evidence becomes missing
with its reason retained in the snapshot and result. Cached timestamps accept ISO
with timezone or epoch milliseconds and normalize to ISO. An account-ID mismatch
still fails closed. Stale/proxy critical evidence returns insufficient_data; optional
missing evidence follows the approved policy.

During customer adaptation add only the approved extraction routes needed to refresh
cached evidence, using inspected connector actions or an evidence-only research agent.
Those customer-specific calls belong before normalization. Every route needs a price,
cache/freshness guard and evidence review from the pilot. This example deliberately
ships no speculative paid provider. Without an implemented custom refresh route,
stale critical evidence stops scoring; the skill does not claim to refresh it.

## Writes, failures and cadence

The play is disabled with noConcurrency. Its model is the HubSpot company extract,
not a native domain-keyed account table. `id` or `hs_object_id` supplies the CRM ID; if both exist they must agree.
updateRecords matches hs_object_id. Verify the extract mapping in the named workspace. Reconcile existing score
properties; the example proposes cargo_score (number), cargo_tier (enum/string),
cargo_rationale (text), cargo_scoring_version (text) and cargo_last_updated_at
(datetime). These names and types require mapping approval before deploy.

Snapshot, Python result and latest attempt status live in custom columns on that
extract. Separate last-scored snapshot/result columns change only after a verified
write, so a failed attempt keeps the evidence behind the previous valid score. Score fields consume only the validated compute tool result. The agent has
read-only context, a scoring tool and no CRM writes. Its schema contains rationale
only. Missing/error results skip CRM writes and retain the last valid score. Before
work the attempt status is error; runtime failures remain visible in run telemetry.
A successful connector invocation is insufficient: verify exactly one returned record
and its expected ID and score properties before writing the success timestamp.
Validate the update response directly because getRecord can omit properties in large
portals. Verify the timestamp update also returns the same record ID and timestamp.
Set the local successful version/stamp last. Inspect partial CRM writes before retry.

Default cadence: weekly evaluation, three-month staleness. The filter includes absent
success stamps, old stamps and absent/different approved versions. changeKinds includes
added, updated and unchanged, so eligible pre-existing rows and controlled version
backfills can enroll. The filter excludes fresh successful rows even if the pipeline's
own write updates the CRM. This is SDK/schema checked, not live schedule verified.
The shipped limit is 25 accounts per sweep, not a lifetime budget. Limit the first run
further by the exact approved pilot account-ID filter before enable; a
model sync or schedule may bill and requires its own approved scope. Recount/version
backfills have separate budgets. Before paid steps the workflow persists an attempt
counter and scoring version. Three consecutive attempts exhaust the allowance for
that version in both the play filter and workflow guard. Success resets the count;
a new version starts a new allowance. Inspect partial writes and repair the cause
before manually resetting a counter. Missing data also consumes attempts: refresh
evidence before resetting. Verify custom-column persistence and freshness across
syncs in the test workspace; stale input counters would defeat the cap. Avoid
automatic retries that repurchase evidence.

## Price preview and handoff

Immediately before any metered preview, fetch the selected integrations' prices.
Present pilot and bulk separately: exact accounts, fields, routes, cache hits,
retry allowance, unit prices with retrieval time and maximum spend. Separate CRM/
source extraction, baseline enrichment, historical reconstruction, custom research,
optional transcripts, LLM explanation and native/hosted execution. Local Python has
no provider enrichment charge; service execution can still be metered.

This repository build performs no paid execution, deployment or source extraction.
A numerical customer estimate is unavailable until the cohort, routes and target
workspace are selected. No paid pilot is authorized by the build brief.
