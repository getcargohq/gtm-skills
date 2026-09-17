---
name: crm-enrichment
description: 'Keep CRM accounts and contacts filled and refresh them when they go stale. The contact pipeline uses one enrichment play with three gated tools: Cargo-native Find Email, Cargo-native Find LinkedIn Profile from Email, and custom Contact LinkedIn Enrichment. Triggers: "keep our CRM accounts filled", "keep our CRM contacts filled", "nobody refreshes the company records", "nobody refreshes the contact records", "enrich my CRM", "refresh stale firmographics", "every new CRM company", "every new CRM contact", "contacts are missing emails, LinkedIn URLs, or titles". HubSpot, Salesforce, Attio, Cargo CDK. Skip when: the records are not in a CRM. A supplied company list is enrich-company-data, a supplied LinkedIn URL list is enrich-linkedin-profile, and a one-time email lookup is find-work-email.'
version: "0.7.0"
compatibility: "Requires the cargo-cdk skill, a Cargo CDK project, @cargo-ai/cdk 1.0.82 or later, and authenticated CRM and LinkedIn connectors. The repository example does not deploy or access a CRM until it is adapted in the consumer project."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/crm-enrichment
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

# CRM enrichment

**State: to-be-approved.** This pipeline has not been deploy-verified against a live workspace.
Review `cargo-ai cdk plan`, the compiled graph, and the live connector schemas before deployment.

## The outcome

CRM accounts and contacts keep their approved enrichment fields filled without overwriting values
that already exist. New records are eligible immediately. Successfully written records become
eligible again after the configured freshness window.

The account path is `enrich_accounts`. It calls `account_enrichment`, selects the LinkedIn company
route or domain fallback, and writes approved blanks to the CRM.

The contact path is one play, `enrich_contacts`, calling three gated tool resources:

1. Cargo-native **Find Email** runs only when LinkedIn is present and email is blank.
2. Cargo-native **Find LinkedIn Profile from Email** runs only when email is present and LinkedIn
   is blank.
3. Custom **Contact LinkedIn Enrichment** runs only after a LinkedIn URL is available.

The contact route matrix is deliberate:

| Starting identifiers | Calls                                                              | Outcome                                         |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| Email and LinkedIn   | Contact LinkedIn Enrichment                                        | Fill approved LinkedIn identity and role blanks |
| LinkedIn only        | Find Email, then Contact LinkedIn Enrichment                       | Fill email and approved LinkedIn blanks         |
| Email only           | Find LinkedIn Profile from Email, then Contact LinkedIn Enrichment | Stop without a write if no profile resolves     |
| Neither              | None                                                               | Stop without a write                            |

The custom tool owns provider access and has no CRM access. The play owns every CRM write. The
checked example targets HubSpot companies and contacts by `hs_object_id`; adapt the connector,
extractor, record ID, write action, and blank-only behavior for Salesforce or Attio.

The starting contact field contract is `email`, `linkedin_person_id`, `linkedin_profile_url`, and
`jobtitle`. The operational fields are `cargo_last_enriched_at` and
`cargo_enrichment_status`. Reuse compatible existing CRM properties. If a destination does not
exist, propose it and wait for approval before creating it.

## Put it in your project

Install the required authoring skill first. If `cargo-cdk` is absent, run:

```sh
npx skills add getcargohq/cargo-skills --skill cargo-cdk
```

Then read `.agents/skills/cargo-cdk/SKILL.md` and follow its state, plan, and deployment rules.

From the Cargo CDK project, install this example with:

```sh
cargo-ai cdk add cookbook/crm-enrichment
```

Or start a project with:

```sh
cargo-ai cdk init <dir> --cookbook crm-enrichment
cd <dir>
npm install
```

Reconcile default connectors and models with existing project resources. Do not deploy duplicate
slugs. Append environment requirements to the project `.env.example`; never overwrite it.

Before changing code, audit the live CRM schema and provider outputs using
[`references/audit.md`](references/audit.md). Apply the approved mappings using
[`references/configure.md`](references/configure.md). Run the disabled pilot and report results
using [`references/run.md`](references/run.md).

For the two Cargo-native contact tools, instantiate the live workspace templates and replace:

- `REPLACE-WITH-FIND-EMAIL-TOOL-UUID`
- `REPLACE-WITH-FIND-LINKEDIN-PROFILE-FROM-EMAIL-TOOL-UUID`

Confirm their live input and output contracts. This example expects Find Email to accept
`linkedin_url`, `first_name`, and `last_name` and return `email`. It expects Find LinkedIn Profile
from Email to accept `email` and return `linkedin_url`.

## What you will be asked

Derive what can be discovered before asking the operator. Ask only for decisions that change the
field contract, target population, or spend.

| Input                   | Kind    | How it is answered                                                                          | Why it matters                                           |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `crm_schema`            | derived | Inspect the existing Cargo connector, extracts, and live CRM properties                     | Determines models, IDs, destinations, and write behavior |
| `provider_schema`       | derived | Inspect the live LinkedIn actions                                                           | Prevents guessed output paths and types                  |
| `native_tool_contracts` | derived | Instantiate and inspect both Cargo-native tools                                             | Makes the play compile against the deployed tools        |
| `approved_fields`       | asked   | Present one row per provider field with destination, type, transformation, and write policy | Controls every CRM mutation                              |
| `eligible_population`   | derived | Count rows with an identifier, stale freshness, and at least one approved blank             | Sets scope and cost                                      |
| `refresh_cadence`       | asked   | Recommend six months unless the operator has a different governance need                    | Controls repeat spend                                    |

No paid call or CRM write occurs during the audit. Build and deploy the resources disabled only
after the operator approves the field contract. Run a paid pilot only after the operator approves
the priced population.

## What you can change

| Variation               | When it is right                                         | How                                                                                                    | What it costs                                              |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `crm_shape`             | The consumer uses Salesforce or Attio                    | Replace the connector, extracts, object names, record IDs, write action, and blank-only guard together | Generated types and write semantics must be reverified     |
| `selected_fields`       | The approved contract differs from the starting fields   | Change tool outputs, CRM destinations, transformations, filters, and mappings together                 | Every added field expands schema and write review          |
| `eligibility`           | Only a governed subset should be enriched                | Intersect the play filter with approved lifecycle, tier, or ownership conditions                       | Narrower scope reduces coverage and paid calls             |
| `refresh_cadence`       | Six months does not fit the data policy                  | Change the freshness condition and report the new repeat-spend impact                                  | Faster cadence repeats provider charges more often         |
| `native_tool_contracts` | The deployed native tools expose different schemas       | Update each `toolRef`, call payload, and result access from the verified live schema                   | A guessed path can create paid calls with no usable result |
| `profile_provider`      | The workspace uses an equivalent approved profile action | Replace the provider call inside `contact_linkedin_enrichment` and remap its output                    | Coverage, fields, and unit price change                    |

Keep each optional provider field as its own decision row. State the live unit price and expected
fill rate before recommending a paid route.

## What should not change

- **One contact play.** Keep contact orchestration in `enrich_contacts`. Do not add parallel plays
  for customer status, personas, or lifecycle stages.
- **Three contact tool resources.** The play uses only Find Email, Find LinkedIn Profile from
  Email, and Contact LinkedIn Enrichment. Explicit workflow branches can compile the custom tool
  into several mutually exclusive call nodes, but they all target the same custom resource.
- **Real branch gating.** Find Email runs only for LinkedIn-only rows. Find LinkedIn Profile from
  Email runs only for email-only rows. Contact LinkedIn Enrichment runs only with a LinkedIn URL.
- **No unresolved write.** When email cannot resolve to a LinkedIn URL, stop without a CRM write
  and without successful freshness.
- **Tools enrich, plays write.** The custom tool cannot access the CRM. Provider actions cannot be
  duplicated directly inside the play.
- **Fill blanks only.** Every business-field mapping uses the CRM-native blank-only flag or an
  equivalent fresh-read guard. Do not overwrite an authoritative CRM value.
- **Freshness follows a write.** Stamp `cargo_last_enriched_at` and
  `cargo_enrichment_status=succeeded` only in the successful CRM write path.
- **Null-safe filters.** Pair `isNull` and `isEmpty` for every blank string condition because CRM
  extracts can represent blanks either way.
- **No contact creation.** Update the triggering CRM row by its record ID. Do not create or merge
  contacts in this pipeline.

Run the compiled graph contract after every adaptation:

```sh
node --import tsx crm-enrichment/evals/contract.mjs
```

## Done when

- The approved field contract names every destination, type, transformation, and write policy.
- The native tool UUIDs and live schemas are verified and placeholders are gone.
- `cargo-ai cdk plan` shows `enrich_contacts` plus exactly the three intended contact tool targets.
- The compiled graph proves both native calls are branch-gated and every custom enrichment call has
  a LinkedIn URL.
- The custom tool contains one LinkedIn profile enrichment action and no CRM connector action.
- Every successful contact route writes by CRM record ID, fills approved blanks only, and stamps
  freshness after the write.
- Email-only rows that do not resolve stop without calling custom enrichment or writing to the CRM.
- Rows with neither identifier make no paid call.
- The account path still chooses exactly one provider route and keeps its CRM write in the play.
- All plays are deployed disabled, then a one-record write probe and approved pilot pass.
- The final report includes eligible, processed, written, unresolved, failed, fill-rate, and credit
  counts with direct Cargo resource links.

The detailed acceptance checklist is in [`evals/acceptance.md`](evals/acceptance.md).

## What it costs

Fetch prices from the live workspace before every run. Quote the unit price for each account
provider action, both Cargo-native contact tools, and the LinkedIn profile enrichment action.

Per contact, the maximum paid chain is two calls:

- LinkedIn only: Find Email plus Contact LinkedIn Enrichment.
- Email only: Find LinkedIn Profile from Email plus Contact LinkedIn Enrichment when resolution
  succeeds.
- Both identifiers: Contact LinkedIn Enrichment only.
- Neither identifier: no paid call.

Show mutually exclusive route counts and calculate the maximum credits before seeking approval.
A failed CRM write can cause provider calls to be billed again on retry, so test write capability
on one record before the batch.

## Composes into

`deduplicate-records` after enrichment, `find-stakeholders` for coverage gaps,
`segment-accounts` for activation, and `track-job-changes` as a separate one-time movement check.
