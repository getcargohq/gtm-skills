# Shared native models

A pipeline's worked example runs on Cargo native models, not on a CRM connector, so it deploys on
a bare workspace. HubSpot, Salesforce and Attio are the `crm-backed` variation the skill documents.
When a pipeline needs accounts, contacts, opportunities or activity, it declares the shared model
below, under exactly this slug, with exactly this definition. A project that installs several
pipelines then keeps one model of each: the placing agent rewires the imports to the first copy
and drops the others.

`scripts/check-native-models.mjs` (part of `npm run validate`) compiles every pipeline's
`infra/models/` and fails when a `gtm_*` model drifts from `scripts/native-models.json`, or when a
native model takes a slug the workspace already owns.

## The models

| Slug                | Extractor       | What it holds                                                                                                     |
| ------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `gtm_accounts`      | `defineAccount` | Companies: `id`, `name`, `website`, `industry`, `number_of_employees`, `description`, `owner_id`, `parent_id`, …  |
| `gtm_contacts`      | `defineContact` | People: `id`, `account_id`, `name`, `first_name`, `last_name`, `title`, `email`, `linkedin_url`, `lead_source`, … |
| `gtm_opportunities` | `defineDeal`    | Deals: `id`, `name`, `account_id`, `amount`, `stage_name`, `close_date`, `next_step`, `is_closed`, `is_won`, …    |
| `gtm_activities`    | `defineCustom`  | One row per meeting, call, email, note or task, with the columns below                                            |

`gtm_activities` columns, in this order: `account_id`, `opportunity_id`, `contact_id` (string, the
ids of the rows above, empty when not tied to one), `occurred_at` (date), `kind` (`meeting`,
`call`, `email`, `note` or `task`), `subject`, `body`, `owner_email` (who on our side did it).

Each model sets `name` to "GTM accounts", "GTM contacts", "GTM opportunities" or "GTM activities",
so the workspace shows one readable name whichever pipeline created it.

```ts
export const gtmActivities = defineModel("gtm_activities", {
  name: "GTM activities",
  kind: "native",
  extractSlug: "defineCustom",
  config: {
    columns: [
      { slug: "account_id", type: "string" },
      { slug: "opportunity_id", type: "string" },
      { slug: "contact_id", type: "string" },
      { slug: "occurred_at", type: "date" },
      { slug: "kind", type: "string" },
      { slug: "subject", type: "string" },
      { slug: "body", type: "string" },
      { slug: "owner_email", type: "string" },
    ],
  },
  folder: modelsFolder,
});
```

## Rules

- **Never `accounts` or `contacts`.** Every workspace's native dataset already has models of those
  slugs (the unify extractors behind `account_events` and `contact_events`). A native model under
  either slug collides with them.
- **Join on ids, not names.** `account_id`, `opportunity_id` and `contact_id` hold the `id` of the
  row in the shared model. Cargo generates every native record id: a write that passes its own
  `id` is rejected, so seed parents first and read the id back from the create.
- **Add columns, never change them.** A pipeline that writes its own output adds it with
  `additionalColumns` on the shared model, under a plain name (`tier`, `tier_reason`,
  `expansion_signal`), never a `cargo_` prefix. Two pipelines' additional columns merge when the
  model is shared. Renaming or retyping a shared column breaks every other pipeline that reads it.
- **Read-only unless it is yours.** An agent gets a shared model read-only on `uses`. Its writable
  state lives in its own ledger model (`meeting_briefs`, `commitments`), named for the pipeline.
- **Ledger times are strings.** An agent writing a native `date` column gets the value back as an
  empty object, and its next model step fails. A ledger an agent writes stores timestamps as ISO
  8601 strings. Columns a play or a sync writes can stay `date`.
- **An agent reads the clock with SQL.** A plain agent has no clock. It reads
  `SELECT CURRENT_TIMESTAMP() AS now, CURRENT_DATE('<timezone>') AS today` before anything that
  depends on the date. A harness agent can run `date`.
- **Name the CRM swap.** The skill's `crm-backed` row says which connector-backed model replaces
  each shared one (`fetchRecords`, every column, no config filter) and which CRM columns map onto
  the shared column names, so the prompts do not change.
