# PLG motion

Spot product-qualified workspaces from usage data, and route them to the right
territory for a human to approve — once per workspace, with the usage context
attached.

## What it does

- Pulls product events and workspaces into standalone Snowflake data models.
- Defines a PQL as a usage threshold (e.g. 10+ key events in 14 days).
- When a workspace crosses it, resolves its territory first (AMER / EMEA).
- Opens an Approve/Decline human-review gate in that territory's Slack channel —
  the workflow blocks until a reviewer approves. On approval it upserts the
  account in HubSpot and assigns the approving reviewer as its owner. Fires only
  once per workspace.

## How it works

1. **Pull in product events + workspaces.** Snowflake feeds the `product-events`
   and `product-workspaces` models (standalone — not the HubSpot `accounts`).
2. **Relate them.** `product-relationships` links events to workspaces on the
   shared `workspace_id`.
3. **Define the PQL.** An occurrence threshold (e.g. 10+ key events in 14 days)
   over those events drives the `pql-accounts` segment on workspaces.
4. **Route + human review.** When a workspace crosses the threshold,
   `pql-handoff` fires once: it resolves the territory first, then opens a
   `humanReview` gate (Approve/Decline) in that territory's channel with the
   AI-written usage context. The workflow blocks until a reviewer approves; on
   approval it upserts the account in HubSpot and sets the approving reviewer as
   its owner.

Adds 6 resources on top of the base: 1 connector, 2 models, 1 relationship,
1 segment, and 1 play (with an embedded workflow).

## Placeholders (edit before deploy)

1. **Key event + threshold** — `event_type`, count, and window in both
   `segments/pqls.ts` and `plays/pql-handoff.ts` define your PQL.
2. **Events table** — `models/product-events.ts` `config` (the `fetchTable`
   database / schema / table and the id / title / cursor column slugs).
3. **Territory review gate** — `plays/pql-handoff.ts` `TERRITORY_CHANNELS`
   (one Slack channel per territory) and the territory rule (defaults to the
   routing-engine geo split). The `humanReview` gate posts through the base
   `slack` connector; ensure it's in each channel. Needs a geo column
   (`country`) on the `product-workspaces` model.
4. **Approval upsert** — `plays/pql-handoff.ts`: the HubSpot upsert matches
   companies on `domain`, so `product-workspaces` needs a `domain` column, and
   the reviewer's Slack id must map to a HubSpot `hubspot_owner_id` (the id
   spaces differ).
5. **Snowflake connector** — set `SNOWFLAKE_PASSWORD` and the
   account/warehouse/database/schema in `connectors/snowflake.ts`; swap the
   integration if product events live elsewhere.
6. **Relationship** — `models/product-relationships.ts` joins workspaces ↔
   product-events on `workspace_id`; adjust the column slugs to your schema.

## Done when

Inject 11 test events for one workspace inside the window: the workspace appears
in `pql-accounts`, the play fires exactly once, an Approve/Decline request lands
in the territory channel, and approving it upserts the account in HubSpot with
the approving reviewer set as its owner.
