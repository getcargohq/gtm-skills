---
name: crm-enrichment
description: 'Keep CRM accounts filled and refresh them when they go stale: a deployed play that fills approved blank firmographics from LinkedIn and re-enrolls a record after six months. Triggers: "keep our CRM accounts filled", "keep our CRM companies filled", "enrich my CRM", "CRM enrichment", "old firmographics keep going stale", "every new CRM account", "every new CRM company", "nobody refreshes the company records", "refresh stale firmographics". HubSpot, Salesforce, Attio, Cargo CDK. Skip when: the records are not in a CRM. A supplied company list is enrich-company-data.'
version: "0.5.1"
compatibility: "Requires a Cargo CDK project and @cargo-ai/cdk ^1.0.51. The repository example does not deploy or access a CRM until an agent adapts it in the consumer project."
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

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

CRM accounts stay filled. New records get approved blanks written from LinkedIn; a record whose
successful fill is older than six months comes back. The play runs on `crm_accounts` — the CRM
account extract — and writes back with that row's CRM record id. It does not overwrite a value
that is already there.

The checked example in `infra/index.ts` is HubSpot (`hs_object_id`, companies
object, `updateRecords` + `skipIfExist`). Salesforce and Attio are the same file adapted:
swap the connector, extractor, record-id field, write action, and fill-blank guard. Do not add
a second CRM branch.

**Two failure modes worth knowing before you start.** If the matching record-id field is wrong,
the run looks successful and every write targets nothing. And if freshness is stamped on a no-op,
a full row leaves the segment for six months without a single field changing — still paying
LinkedIn first.

The starting recommendation is identity and size. On HubSpot that is `name`, `domain`, `website`,
`linkedin_company_page`, and `numberofemployees`. Before counting the target population or editing
CDK, the agent derives the other LinkedIn fields that can map to live CRM properties and presents
them with their type and transformation costs. The operator approves the field contract. That
approved contract, not the repository default, controls the mappings, fill-state filter, and final
cost preview. The audit JSON contract lives in
[`references/audit.md`](references/audit.md); provider field paths and the selection gate in
[`references/configure.md`](references/configure.md).

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job
is to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not,
this is enough.

1. **Install it — the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/crm-enrichment` writes this example to `infra/crm-enrichment/` and
   this procedure to `.claude/skills/crm-enrichment/`. No project yet?
   `cargo-ai cdk init <dir> --cookbook crm-enrichment && cd <dir> && npm install` does both; this
   folder never ships a shell. **If you are reading this from the project's `.claude/skills/`, the
   install already happened — start at step 2.** On a CLI too old to have `add`, copy this folder
   in as a sibling of what is there by hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** For every model or connector this example
   carries that the project already has (a HubSpot connector, an account extract), rewire the
   imports to the existing one and drop the copy. Two resources with one slug is a collision at
   deploy. The play must keep running on that CRM account model (`crm_accounts` in the example).
   Append this folder's `.env` needs to the project's `.env.example`; never overwrite it.
3. **Select fields before target math.** Re-read the live LinkedIn output and CRM property schemas.
   Follow the field-selection gate in [`references/configure.md`](references/configure.md): present
   the starting recommendation, direct-compatible optional fields, transformation-required fields,
   and unsupported fields with reasons. Stop for approval of the complete field contract. Do not
   calculate the final target or edit CDK while its status is `pending_operator_approval`.
4. **Audit the approved contract before you edit.** Fetch current LinkedIn prices with
   `cargo-ai connection integration get linkedin`. Write the audit JSON and Markdown from
   [`references/audit.md`](references/audit.md). Eligibility and fill-state counts use every
   approved destination. A completed audit has matching JSON, Markdown, and chat counts, and has
   made no paid call and no CRM write.
5. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted (nobody asks for a variant they do not know exists); _What you will be asked_
   is the floor, and you derive before you ask. If you are asking more than about four questions
   you have skipped lookups. Record what you changed and why under a `## Decisions` section in
   your copy of this file. Do not enable the play until the disabled pilot has passed.
6. **Plan, then stop.** `cargo-ai cdk types && cargo-ai cdk check && cargo-ai cdk plan` in the
   consumer project. Show the diff. Deploy only on an explicit yes: `cargo-ai cdk deploy`. Never
   `cdk init --force` into a non-empty directory.
7. **Verify.** Walk _Done when_ line by line and report each with evidence. Deployed cleanly and
   produced nothing is the normal failure.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the ones marked
_asked_ genuinely live in the operator's head.

| Input                     | Kind    | How it is answered                                                                                     | Why it matters                                                       |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `crm`                     | derived | Inspect authenticated connectors and existing CDK resources                                            | Reusing them prevents a second CRM connector and a second extract    |
| `field_candidates`        | derived | Join live LinkedIn paths and types to live CRM properties, fill rates, and compatible transformations  | The operator should choose from evidence, not recall provider fields |
| `approved_field_contract` | asked   | Review the recommended base fields, optional candidates, transformations, destinations, and exclusions | It defines every write mapping and which blank rows are eligible     |
| `target_population`       | asked   | Review counts by identifier route, percentage, and current action credits after field approval         | The operator controls scope and spend before any paid call           |

Checked before moving on, not after the deploy:

- `crm`: one authenticated CRM connector, and the play model is that connector's account extract
- `approved_field_contract`: every selected provider path has a live destination, compatible type
  or explicit transformation, fill-blank policy, and recorded operator approval
- `target_population`: eligibility uses the approved destinations; LinkedIn and domain route
  counts are mutually exclusive and reproduce the credit estimate

The first operator question comes after the field candidates are derived. Do not ask whether they
want "more fields" without showing the choices. Present a concise field-contract table and ask
which recommended and optional rows to include. Do not treat silence as approval of the defaults.

Refreshing populated business fields is outside the base template. If requested, that is
`approved_refresh_behavior` below, not a silent default.

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the default.

| Variation                   | When it is right                                               | How                                                                                                                                                                                                                                                                                                                                                                                 | What it costs                                                                        |
| --------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `crm`                       | The consumer uses Salesforce or Attio instead of HubSpot       | Keep one CRM shape in `infra/index.ts`. The file is the HubSpot example. **Salesforce:** generated Account update matching `Id`; there is no `skipIfExist` — read the Account first and omit any field that is already populated, including numeric zero. **Attio:** generated company-record update matching the record id; same read-then-omit guard. Do not copy HubSpot's flag. | Live generated types must be rechecked; a guessed flag writes or no-ops silently     |
| `selected_fields`           | The approved contract differs from the starting recommendation | Present every live candidate at the field-selection gate. After approval, change the result schema, destinations, fill-state filter, and both provider mappings in `infra/index.ts`. Industry requires an approved array-to-enum transformation when the CRM destination is a single enum.                                                                                          | Each added field expands mapping, type-review, and the "already filled" filter       |
| `eligibility`               | Only a governed subset should be enriched                      | Intersect the play filter with approved lifecycle, tier, ownership, or gap conditions (`infra/index.ts` `enrichAccounts`)                                                                                                                                                                                                                                                           | Narrower scope reduces coverage and paid calls                                       |
| `approved_refresh_behavior` | Populated fields must be refreshed after explicit approval     | Drop `skipIfExist` / the read-then-omit guard on the approved fields only, preview the replacements, and compare against a fresh CRM read (`infra/index.ts`)                                                                                                                                                                                                                        | Refresh can overwrite CRM-authoritative values if the preview and the write disagree |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The play runs on `crm_accounts` and matches the CRM record id.** (`infra/index.ts`) HubSpot's example uses `hs_object_id`. Sending a Cargo row id, or a native `accounts` id, to a CRM action targets the wrong identifier system; the run looks successful and nothing lands.
- **One CRM shape in the file.** (`infra/index.ts`) The checked example is HubSpot. Adapt that one file for Salesforce or Attio. Parallel HubSpot/Salesforce/Attio branches drift from the generated types of the CRM that is actually connected.
- **At most one paid route per row, LinkedIn URL first.** (`infra/index.ts` `enrichCrmAccount`) A row without a handle or a domain makes no paid call. A handle that is already an `http` URL is used as-is; otherwise it is prefixed as `https://www.linkedin.com/company/<handle>`.
- **Destinations are live properties on the connected CRM.** (`infra/index.ts`) The HubSpot example writes `name`, `domain`, `website`, `linkedin_company_page`, `numberofemployees`, `cargo_last_enriched_at`, and `cargo_enrichment_status`. Leaving another CRM's names in the file can write provider data into the wrong property.
- **Fill approved blanks only.** (`infra/index.ts` `skipIfExist` or the Salesforce/Attio read-then-omit guard) A stale snapshot overwrites authoritative CRM data, including numeric zero.
- **Do not stamp freshness on a no-op.** (`infra/index.ts`) If every destination in the approved field contract is already populated, return `skipped_already_filled` and make no paid call. Stamping `cargo_last_enriched_at` / `cargo_enrichment_status: succeeded` on that row hides it for six months.
- **The play filter is the managed segment.** (`infra/index.ts` `enrichAccounts`) Daily evaluation, `changeKinds: ["added"]`, freshness null or older than six months, and at least one approved blank. A standalone `defineSegment` drifts from the play.
- **The first play is disabled and `noConcurrency`.** (`infra/index.ts`) Removing those expands an unapproved pilot.
- **No credentials, deploy commands, or customer data in this repository.**

## Done when

- the audit JSON, Markdown, and chat summary agree on every count
- the audit records an operator-approved field contract with provider paths, live CRM destinations,
  types, transformations, write policies, and reasons for every exclusion
- the CDK plan contains one CRM account model (`crm_accounts`) and no native `accounts` unification
- generated consumer types confirm the selected provider fields, CRM destinations, write action,
  and fill-blank semantics
- every destination is a live property on the connected CRM
- a record without an identifier, and a record whose approved destinations are already filled,
  exits before a paid call (`skipped_no_identifier` / `skipped_already_filled`)
- the play targets `crm_accounts` and the write matches the audited CRM record id
- the managed segment uses the blank-or-six-month rule, daily evaluation, and
  `changeKinds: ["added"]`
- the first plan shows `isEnabled: false` and `runCreationRule: noConcurrency`
- LinkedIn and domain route counts are mutually exclusive and reproduce the credit estimate

## What it costs

Immediately before every preview, run `cargo-ai connection integration get linkedin`. Read the
applicable current entries from `integration.actions.enrichCompany.credits.costs` and
`integration.actions.enrichCompanyFromDomain.credits.costs`. Record the CLI version, lookup time,
action slugs, and selected unit costs. Then preview
`linkedin_url_path * linkedin_url_unit_credits + domain_path * domain_unit_credits`.

This play runs on eligible `crm_accounts` rows and updates that same CRM record. Eligibility means
the row has an identifier, passes freshness and governance filters, and has at least one blank
destination in the approved field contract. Recompute the target and credit preview after field
approval because adding a destination can add eligible rows. Report the segment count.
Deduplication follows enrichment because the new matching keys improve duplicate detection.

Do not enable the daily schedule until the disabled pilot has passed. Enabling is not an
input; it is the last yes after _Done when_.

## Composes into

`account-scoring` (a filled book is what the scorer can cite), `find-stakeholders` (the buyers at
every filled account), `tam-building` (the universe these records join).
