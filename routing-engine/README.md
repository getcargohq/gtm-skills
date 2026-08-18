# Routing engine

Define your sales territories and rep capacity as code, and automatically assign
accounts to the right territory — on arrival and re-checked weekly.

## What it does

- Defines territories (e.g. AMER / EMEA) with weighted members and a fallback.
- Defines per-rep capacity caps over your accounts.
- Stamps each new account with its territory when it arrives, and allocates it
  to a rep in that territory (weighted round-robin, capped by capacity).
- Re-routes the whole book weekly, so rule changes take effect.

## How it works

1. **Territories + capacity are defined.** `amer` / `emea` hold weighted members
   and a fallback; `account-book` sets per-rep caps.
2. **A new account arrives** in the base `accounts` model.
3. **Route it.** The `route-accounts` play picks a territory from your rules
   (e.g. country → AMER for US/Canada, EMEA otherwise).
4. **Stamp, allocate + alert.** It writes `territory` onto the CRM record,
   allocates the account to a member of that territory via the native
   `allocate` action (capped by `account-book`), and posts a Slack routing alert.
5. **Re-route weekly.** The whole book re-runs on a schedule so rule changes
   propagate.

Adds 4 resources on top of the base: 2 territories, 1 capacity, and 1 play
(with an embedded workflow).

## Placeholders (edit before deploy)

1. **Member uuids** — `territories/regions.ts`: your workspace members with
   routing weights (Workspace settings → Members).
2. **Territory rules** — `plays/route-accounts.ts`: the country → territory
   branch is the simplest version; extend with segment or named-list rules.
3. **Slack channel** — `plays/route-accounts.ts` `channelId`.
4. **Identity column** — `capacities/book.ts` `idColumnSlug` if your accounts
   model doesn't key on `domain`.

## Member allocation

`route-accounts` assigns the individual _member_ (weighted round-robin within the
territory, respecting capacity) via the platform's native `allocate` action —
`native.allocate({ ... })` in the workflow, referencing `amer`/`emea` and
`account-book`. The full native surface (including `allocate`) is generated into
`.cargo-ai/cargo-types.d.ts` by `cargo-cdk types` (run on `postinstall`). Note
`allocate`'s input is untyped (`Record<string, unknown>`); the field shape is
inferred from `RevenueOrganizationTypes.AllocatedBy`, so confirm it on first
`cargo-cdk plan`/run.

## Done when

Add a test account: the play stamps `territory` on the CRM record (AMER for
US/Canada, EMEA otherwise) and posts the routing alert. The territories and
capacity appear under the workspace's revenue organization.
