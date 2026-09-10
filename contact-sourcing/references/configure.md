# Configure the on-demand tool

Use the approved personas from `audit.md` and the consumer's current resources.
`infra/index.ts` is the sole infrastructure adaptation surface. Defaults are
fictional and unapproved; derive facts, explain choices, and build only the
selected configuration. Read `cargo-cdk` and reconcile compatible connectors and
tools before adding resources. The default plan is one tool, its folder and
three adopted connectors; no CRM, model, play or research agent is required.

## Company input: remove unnecessary resolution

Explain that an existing LinkedIn company ID avoids a company lookup. Recommend
ID input when upstream company enrichment already supplies it. A URL or domain
is more convenient when that is what the operator has, but pays for resolution
before people search. This is the tradeoff to present before asking:

> What company identifier will you usually pass to this tool: LinkedIn company
> ID, LinkedIn company URL, or domain?

Set `inputMode` to `id`, `url` or `domain`. Show the resulting path:

| Input                | Configured path                                                    | Resolution spend      |
| -------------------- | ------------------------------------------------------------------ | --------------------- |
| LinkedIn company ID  | Validate numeric ID → current-company search                       | None                  |
| LinkedIn company URL | `linkedin.enrichCompany` → validate returned ID → search           | One URL resolution    |
| Domain               | `linkedin.enrichCompanyFromDomain` → validate returned ID → search | One domain resolution |

Recommend `multiple` only when several upstream sources require it; extra routes
increase configuration and identity checks. It prefers a valid ID, otherwise URL,
then domain, and runs only the necessary path. An invalid ID can fall through to a valid URL/domain with an explicit warning. A failed URL resolution does not
silently try a different company from a domain.

Conflicting numeric ID/URL pairs stop. When an ID is supplied alongside a slug
URL or domain, provide the upstream, already-verified `resolvedCompany` record
(`company_id`, `linkedin_url`, `domain` or `website`) that ties those identifiers
together. No new enrichment is called. Without that evidence the tool returns
`company_not_resolved` with a reason requesting ID alone or existing resolution.
This conservative rule avoids silently treating unrelated supplied identifiers
as one company. Do not manufacture the record by echoing the inputs. Account
context belongs in `accountContext` and is passed to qualification.

Verify that the upstream ID is a LinkedIn numeric company ID accepted by
`company.currentCompanyIds`, not a CRM ID or an opaque Sales Navigator identifier.
Company resolution must yield a single valid ID and agree with supplied URL and
domain evidence. Missing/ambiguous resolution stops before people search; there
is no unscoped fallback. Canonicalization removes URL tracking parameters and
normalizes the host; redirect/alias mismatches remain unresolved until their
identity is checked and the adapter is updated deliberately.

## Output: choose flexibility or a ready-to-use result

Explain that the full ranking gives different plays freedom to select their own
people. An enriched shortlist is ready to consume but pays for fields now and
commits to one N. Recommend ranked mode when a downstream play owns selection or
when only relevance is needed; recommend shortlist when the operator needs
contact details with the result. Ask:

> Should this tool return all qualified contacts ranked by relevance, or only
> the top N enriched with contact information?

`outputMode: ranked` returns every qualified person found within the search limit
and performs no email lookup, verification or phone lookup. It emits none of those
nodes. A play can consume `contacts.slice(0, N)` directly.

For `shortlist`, ask:

> How many contacts per account? Do you need verified work email, phone, or both?

Five is a suggested example only. Set `topN` and `email`/`phone`. The native slice
selects up to N **before** contact lookup, and only the requested fields exist in
the graph. Fewer qualified contacts return fewer than N. A missing address or
failed phone lookup never drops a selected person or causes automatic backfill.
If the operator requests N reachable people, explain that lower-ranked lookups
are a separate variation requiring maximum attempts and additional cost approval.

Inspect and reuse existing enrichment tools. The read-only reference tools accept
email inputs `firstName`, `lastName`, `companyDomain`, `linkedinUrl`,
`returns_catchalls: false`, and phone input `linkedinUrl`. Their outputs are
`email` and `phone`. Copy **no reference UUID** into a consumer or public example;
derive the consumer's own IDs for `emailToolUuid` and `phoneToolUuid` and inspect
its release. Tools with different contracts require an adapted node mapping.

The checked email tool returns only an address, so also resolve an existing
`waterfall` connector for `emailVerificationConnectorUuid`. `verifyEmail` accepts
`email` and returns `email_status`; only the audited `valid` result maps to
`verified`. Catch-all, missing or unknown status is not verified; invalid remains
invalid. If an existing tool returns equivalent explicit verifier evidence, reuse
that result and remove the redundant verifier node after updating the contract.
Do not label any found email verified merely because the tool is named “Find email”.
Confirm that the selected lookup tool returns work emails; reject a provider
configuration that mixes personal emails into this contract.

Reuse existing data through optional `knownContacts`, matched by stable person
ID or canonical LinkedIn URL. Each item may include `personId`, `linkedinUrl`,
`email`, `verificationStatus`, `emailMeetsRequirements`, `phone` and
`phoneMeetsRequirements`. Set those booleans only from the approved work-email,
verification, freshness and phone requirements. A non-empty value is not enough.
Conflicting reusable values trigger a fresh lookup for that selected person.
No email/phone field requires another LinkedIn profile retrieval.

## Search coverage and qualification

Explain that the **search limit** controls candidate coverage and profile/AI
spend; **N** controls how many already-qualified people receive contact lookup.
They are separate limits. Recommend a modest page-aligned cap such as 25 or 50
for a first sample, based on account size and persona breadth; raise it only when
missed stakeholders justify the added cost. Sales Navigator returns pages of 25:
a search limit of 30 requests up to 50 provider rows but profiles only the first 30. Show both numbers and their separate costs before accepting that choice.

Recommend no numeric minimum until the anchors have been calibrated against
representative accounts. If a minimum is wanted, propose it from reviewed
examples, explain which contacts it would remove, and ask for the operator's
choice. There is no universal relevance threshold. Geography/business-unit
restrictions should follow the approved use case; explain the exclusions and
confirm them with the cap and optional minimum. Build the chosen settings and
show the graph/payload before the sample.

The profile supplies responsibilities, experience dates and employment evidence
before ranking. Email/phone enrichment supplies contact information after
selection. Explain these as separate costs at this point. A title or a deal
association alone cannot establish responsibility, buying authority or champion
status. Concurrent community/advisory roles are not automatically primary
employment. Other employees' titles cannot establish reporting lines.

## Current provider contract

Live metadata was read on 2026-09-09 with Cargo CLI 1.0.91. Re-read it at
installation; metadata inspection makes no paid provider run.

| Step               | Action and inputs                                                                                                                                       | Returned paths used                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolve URL        | `linkedin.enrichCompany` with `linkedinUrl`                                                                                                             | `company_id`, `linkedin_url`, `domain`, `website`, `company_name`                                                                                 |
| Resolve domain     | `linkedin.enrichCompanyFromDomain` with `domain`                                                                                                        | Same identity fields; verify agreement/ambiguity                                                                                                  |
| Source             | `salesNavigator.searchLeads` with `company.currentCompanyIds`, `role.titleKeywords`, optional `role.titleKeywordsExclude`, `personal.geoCodes`, `limit` | Bare array; `linkedin_profile_id`, `linkedin_profile_url`, `full_name`, `job_title`; numeric LinkedIn and opaque Sales Navigator IDs are separate |
| Profile            | `linkedin.enrichProfile` with `linkedinUrl`                                                                                                             | Flat `profile_id`, `linkedin_url`, `full_name`, `job_title`, `company`, `company_domain`, `experiences`, `about`; preserve the full object        |
| Qualify            | `openAi.instruct` with `model`, `prompt`, `output.responseFormat: json_schema`, `output.jsonSchema`                                                     | Structured `.answer`; this wrapper is confirmed by saved references, absent from the integration's output schema                                  |
| Work email / phone | Existing consumer tools, only after selection                                                                                                           | Inspect each deployed release's actual output mapping                                                                                             |
| Verify new email   | `waterfall.verifyEmail` with `email`                                                                                                                    | `email_status`; `valid` is the checked verified value                                                                                             |

Read `cargo-ai connection integration get <slug>` and the matching tool releases.
Use generated consumer types and inspect autocomplete where required. In
particular, `personal.geoCodes` uses `listGeoCodes`; do not pass country names as
codes. `role.titleKeywords` supports strings/arrays; it is not a generic Boolean
parser. LinkedIn authentication identities, if needed in the consumer workspace,
come from `listIdentityIds`; do not confuse acting identities with company IDs.

`qualificationModel` remains configurable; current Cargo metadata lists
`gpt-5-mini` as supported and recommended. Keep the stable output schema and score
anchors when changing it. This production setting is independent of the model
used by Conductor to author the skill. Web search is off; the current example
sets an output-token ceiling with reasoning headroom and does not assume an
unsupported temperature setting. Cost it using the actual model and token policy.

## Returned contract

The top-level `contacts` array is simple to slice in a play. Each account call
returns:

| Field                  | Meaning                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account`              | `companyId`, `linkedinCompanyUrl`, `domain`, `name`; unknown values are null                                                                                         |
| `status`               | `succeeded`, `partial`, `company_not_resolved`, `search_failed`, `qualification_failed`, or `no_qualified_contacts`                                                  |
| `reason`               | Company-resolution/identity failure reason, otherwise null                                                                                                           |
| `warnings`             | Input warnings, such as a malformed ID ignored in favor of a valid URL/domain                                                                                        |
| `criteriaVersion`      | Approved criteria version used for this run                                                                                                                          |
| `contacts`             | Qualified people sorted by numeric score descending, stable identity ascending; selected subset in shortlist mode                                                    |
| `insufficientEvidence` | Identifiable cases outside the qualified ranking, including failed profile/qualification cases                                                                       |
| `coverage`             | Returned/examined/unique counts, duplicates, unidentified/conflicting identities, qualified/selected/excluded/insufficient counts, cap flag and stage failure counts |

A contact includes `identity`, `aliases`, `name`, `currentJobTitle`,
`currentCompany`, `personId`, `linkedinUrl`, full retrieved `profile`, `rank` and
`qualification`. Qualification contains `status` (`qualified`, `not_relevant`,
`insufficient_evidence`), numeric `score` on 0–10, `matchedPersona`, likely
`buyingRole`, `employment`, `explanation`, `evidence` and `flags`. Invalid model
outputs cannot qualify; absent scores on failed/insufficient cases are null.
Qualified entries must name an approved persona and cite profile evidence.

Shortlist contacts additionally include `email`, `verificationStatus`, `phone`,
`enrichmentStatus`, `emailStatus` and `phoneStatus`. Unrequested fields have null
values and `not_requested` status. Requested fields distinguish reused,
succeeded, missing, failed and unverified; verifier failure is
`emailStatus: verification_failed`. The person stays selected in every case.
Parallel results are joined to the original selected identities, preserving the
original profile, qualification and rank.

`partial` means some usable results coexist with profile/qualification failures,
or selected contacts have incomplete enrichment. `qualification_failed` means
qualification/profile failures occurred and no qualified contact remains.
`no_qualified_contacts` means search succeeded with no qualified people; it can
still include insufficient evidence. Do not relabel either as a search failure.
The failure counters count affected people, not provider retries or credits.
`returned` counts provider rows; `examined` is capped before deduplication;
`qualified` is the full qualifying count and `selected` is the returned count.
`searchCapReached`/`coverageLimited` means coverage may be incomplete, not that
more qualified people are known to exist.

## Build and approval

Adapt in the consumer project, run the exact scripts/graph contracts after
mapping changes, then generate types, check and plan. Repository commands are
`npm run typecheck`, `npm run validate`, `npm run format:check` and
`node --import tsx contact-sourcing/evals/contract.mjs`. The contract locates either repository or installed `infra/contact-sourcing/index.ts`
layout automatically. For a custom layout, set `CONTACT_SOURCING_INFRA` to the
adapted file when running the copied contract. Preserve that same tested implementation.
The repository checks its standalone resource inventory; an installed copy can
import existing handles. Review the consumer plan for accidental duplicate
resources or unrelated changes, and adapt fictional response mappings when
reusing tools with different contracts.

Show the actual chosen graph and plan; obtain criteria/configuration approval
and explicit consumer deployment authorization before resource creation. After
that authorization, deploy and show what was created. Do not interpret an
authorized deployment as a paid sample or batch approval.
