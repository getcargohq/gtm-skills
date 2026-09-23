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

Choose the account path, contact path, or both. Each selected path has its own model, tool contract,
play, field approval, cost preview, pilot, and acceptance criteria. Approval for one path does not
authorize the other.

### Path 1: Account enrichment

`enrich_accounts` keeps approved company identity and firmographic fields filled. It calls
`account_enrichment`, selects the LinkedIn company route or domain fallback, and writes approved
blanks to the triggering CRM account. A row takes only one provider route.

The starting HubSpot destinations are `linkedin_company_id`, `name`, `domain`, `website`,
`linkedin_company_page`, and `numberofemployees`.

### Path 2: Contact enrichment

`enrich_contacts` is one play calling three gated tool resources:

1. Cargo-native **Find Email** runs only when LinkedIn is present and email is blank.
2. Cargo-native **Find LinkedIn Profile from Email** runs only when email is present and LinkedIn
   is blank.
3. Custom **Contact LinkedIn Enrichment** runs only after a LinkedIn URL is available.

| Starting identifiers | Calls                                                              | Outcome                                         |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| Email and LinkedIn   | Contact LinkedIn Enrichment                                        | Fill approved LinkedIn identity and role blanks |
| LinkedIn only        | Find Email, then Contact LinkedIn Enrichment                       | Fill email and approved LinkedIn blanks         |
| Email only           | Find LinkedIn Profile from Email, then Contact LinkedIn Enrichment | Stop without a write if no profile resolves     |
| Neither              | None                                                               | Stop without a write                            |

The starting HubSpot destinations are `email`, `linkedin_person_id`, `linkedin_profile_url`, and
`jobtitle`. This path contains no customer split, movement detection, relationship mutation, note
creation, or alerting.

### Shared write contract

Both plays run directly on their CRM extracts and match the CRM record ID. The custom tools own
provider access and have no CRM access. The plays own every CRM write. Business fields fill blanks
only. `cargo_last_enriched_at` and `cargo_enrichment_status` are stamped only after a successful
write.

The checked example targets HubSpot companies and contacts by `hs_object_id`. Adapt the connector,
extracts, record IDs, write action, and blank-only behavior together for Salesforce or Attio.

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

Choose the account path, contact path, or both before the audit. Follow the selected path sections
in [`references/audit.md`](references/audit.md), [`references/configure.md`](references/configure.md),
and [`references/run.md`](references/run.md). Walk the matching path in
[`evals/acceptance.md`](evals/acceptance.md). If both paths are selected, both must pass separately.

### Account path setup

Verify the live CRM company schema and both LinkedIn company actions. Approve the account field
contract before adapting `crm_accounts`, `account_enrichment`, or `enrich_accounts`.

### Contact path setup

Instantiate the two Cargo-native tools and replace:

- `REPLACE-WITH-FIND-EMAIL-TOOL-UUID`
- `REPLACE-WITH-FIND-LINKEDIN-PROFILE-FROM-EMAIL-TOOL-UUID`

Confirm their live contracts. This example expects Find Email to accept `linkedin_url`,
`first_name`, and `last_name` and return `email`. It expects Find LinkedIn Profile from Email to
accept `email` and return `linkedin_url`.

No paid call or CRM write occurs during either audit. Deploy selected resources disabled only after
the matching field contract is approved. Run a paid pilot only after the operator approves that
path's priced population.

## What you will be asked

Derive what can be discovered before asking the operator. Ask only for decisions that change the
selected path's field contract, target population, cadence, or spend.

### Shared inputs

| Input            | Kind    | How it is answered                                                             | Why it matters                                                   |
| ---------------- | ------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `crm_shape`      | derived | Inspect authenticated connectors, selected extracts, and live CRM properties   | Determines objects, record IDs, destinations, and write behavior |
| `selected_paths` | derived | Read whether the request names account enrichment, contact enrichment, or both | Sets which resources, audits, approvals, and pilots are in scope |

### Path 1: Account inputs

| Input                     | Kind    | How it is answered                                                  | Why it matters                          |
| ------------------------- | ------- | ------------------------------------------------------------------- | --------------------------------------- |
| `account_provider_schema` | derived | Inspect both live LinkedIn company actions                          | Prevents guessed output paths and types |
| `account_field_contract`  | asked   | Review one decision row per company provider property               | Controls every company mutation         |
| `account_population`      | derived | Count mutually exclusive LinkedIn URL and domain fallback routes    | Sets account scope and spend            |
| `account_run`             | asked   | Review disabled resource links, exact population, and maximum spend | Authorizes only the account pilot       |

### Path 2: Contact inputs

| Input                    | Kind    | How it is answered                                                    | Why it matters                                    |
| ------------------------ | ------- | --------------------------------------------------------------------- | ------------------------------------------------- |
| `contact_tool_contracts` | derived | Inspect profile enrichment and both instantiated Cargo-native tools   | Prevents guessed inputs, output paths, and prices |
| `contact_field_contract` | asked   | Review one decision row per contact provider property                 | Controls every contact mutation                   |
| `contact_population`     | derived | Count both-identifiers, LinkedIn-only, email-only, and neither routes | Sets contact scope and spend                      |
| `contact_run`            | asked   | Review disabled resource links, exact population, and maximum spend   | Authorizes only the contact pilot                 |

## What you can change

### Shared variations

| Variation         | When it is right                                | How                                                                                                             | What it costs                                          |
| ----------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `crm_shape`       | The consumer uses Salesforce or Attio           | Replace the connector, selected extracts, object names, record IDs, write action, and blank-only guard together | Generated types and write semantics must be reverified |
| `refresh_cadence` | The default window does not fit the data policy | Change freshness independently for each selected path and report repeat-spend impact                            | Faster cadence repeats provider charges more often     |

### Path 1: Account variations

| Variation                | When it is right                                               | How                                                                                        | What it costs                                              |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `account_fields`         | The approved company contract differs from the starting fields | Change account tool outputs, CRM mappings, and transformations together                    | Every added field expands schema and write review          |
| `account_eligibility`    | Only a governed company subset should be enriched              | Intersect the account play filter with approved lifecycle, tier, or ownership conditions   | Narrower scope reduces coverage and paid calls             |
| `account_refresh_policy` | Approved populated company fields must be refreshed            | Remove blank-only protection only for approved fields and compare against a fresh CRM read | The provider snapshot can replace CRM-authoritative values |

### Path 2: Contact variations

| Variation               | When it is right                                              | How                                                                                       | What it costs                                              |
| ----------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `contact_fields`        | The approved person contract differs from the starting fields | Change custom tool outputs, contact mappings, blank filters, and transformations together | Every added field expands schema and write review          |
| `contact_eligibility`   | Only a governed contact subset should be enriched             | Intersect the contact play filter with approved lifecycle, tier, or ownership conditions  | Narrower scope reduces coverage and paid calls             |
| `native_tool_contracts` | The deployed native tools expose different schemas            | Update each `toolRef`, call payload, and result access from the verified live schema      | A guessed path can create paid calls with no usable result |
| `profile_provider`      | The workspace uses an equivalent approved profile action      | Replace the provider call inside `contact_linkedin_enrichment` and remap its output       | Coverage, fields, and unit price change                    |

Keep every optional provider field as its own decision row. State the live unit price and expected
fill rate before recommending a paid route.

## What should not change

### Shared invariants

- **Each path runs on its direct CRM extract.** The account play matches the company record ID and
  the contact play matches the contact record ID. A second identity system makes writes look
  successful while nothing lands.
- **Tools enrich and plays write.** Custom tools contain no CRM access. Plays do not duplicate
  provider connector actions.
- **Fill approved blanks only.** Every business-field mapping uses a CRM-native blank-only flag or
  an equivalent fresh-read guard. Do not overwrite an authoritative CRM value without an explicit
  field-level refresh approval.
- **Freshness follows a write.** Stamp `cargo_last_enriched_at` and
  `cargo_enrichment_status=succeeded` only on successful CRM write paths.
- **Selected plays deploy disabled and use `noConcurrency`.** Removing either expands an unapproved
  pilot.

### Path 1: Account invariants

- **LinkedIn first, domain fallback.** One account takes exactly one provider route. Rows without
  either identifier make no paid call.
- **One account tool and one account play.** `account_enrichment` owns provider routing;
  `enrich_accounts` owns the only company write.
- **Account eligibility does not require a blank destination.** Populated stale records remain
  eligible for an explicitly approved refresh policy.

### Path 2: Contact invariants

- **One contact play and three tool resources.** Keep contact orchestration in `enrich_contacts` and
  use only Find Email, Find LinkedIn Profile from Email, and Contact LinkedIn Enrichment.
- **Real branch gating.** Find Email runs only for LinkedIn-only rows. Find LinkedIn Profile from
  Email runs only for email-only rows. Contact LinkedIn Enrichment runs only with a LinkedIn URL.
- **No unresolved write.** When email cannot resolve to LinkedIn, stop without custom enrichment,
  CRM write, or successful freshness.
- **Null-safe blank filters.** Pair `isNull` and `isEmpty` for every contact string destination.
- **No contact creation or movement tracking.** Update only the triggering contact. Do not create,
  merge, move, or alert on contacts in this path.

Run the compiled graph contract after every adaptation:

```sh
node --import tsx crm-enrichment/evals/contract.mjs
```

## Done when

Complete only the selected paths. If both were selected, both lists must pass.

### Path 1: Account completion

- The approved account field contract names every destination, type, transformation, and write
  policy.
- The plan contains one account model, one account enrichment tool, and one disabled account play.
- The compiled graph proves one mutually exclusive company provider route and one play-owned CRM
  write.
- The account write matches the audited company record ID and preserves populated business values.
- The account write probe and approved pilot pass.
- The account report includes route, processed, written, skipped, failed, fill-rate, spend, and
  direct-link evidence.

### Path 2: Contact completion

- The approved contact field contract names every destination, type, transformation, and write
  policy.
- Native tool UUIDs and live schemas are verified and placeholders are gone.
- The plan contains one contact model, exactly three contact tool targets, and one disabled contact
  play.
- The compiled graph proves both native calls are gated and every custom enrichment call has a
  LinkedIn URL.
- Unresolved and identifier-free rows stop without custom enrichment, CRM write, or successful
  freshness.
- The contact write probe and approved pilot pass.
- The contact report includes route, processed, written, unresolved, skipped, failed, fill-rate,
  spend, and direct-link evidence.

The complete evidence checklist is in [`evals/acceptance.md`](evals/acceptance.md).

## What it costs

Fetch live prices from the workspace before every preview. Cost only the selected paths. A failed
CRM write can cause provider calls to be billed again on retry, so probe write capability before a
batch.

### Path 1: Account cost

Quote both LinkedIn company actions. Multiply the mutually exclusive LinkedIn URL and domain
fallback populations by their respective live unit prices. Rows with neither identifier make no
paid call.

### Path 2: Contact cost

Quote both Cargo-native tools and the LinkedIn profile enrichment action. Per contact, the maximum
paid chain is:

- LinkedIn only: Find Email plus Contact LinkedIn Enrichment.
- Email only: Find LinkedIn Profile from Email plus Contact LinkedIn Enrichment when resolution
  succeeds.
- Both identifiers: Contact LinkedIn Enrichment only.
- Neither identifier: no paid call.

Show mutually exclusive route counts and maximum spend before requesting approval for either path.

## Composes into

`crm-deduplication` after account enrichment, `find-stakeholders` for coverage gaps,
`segment-accounts` for activation, and `track-job-changes` as a separate one-time movement check.
