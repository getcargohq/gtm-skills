# Expansion signals

Every Monday the customers coming up on renewal are judged for an expansion moment, the judgment is
written onto the HubSpot company, and one digest lands in Slack for the customer team.

## What it does

- Syncs every HubSpot company and deal into two models, every column.
- A weekly play selects customers whose most recent deal closed ten to twelve months ago and who
  were not judged in the last sixty days.
- An agent judges each one from its deal history, your expansion plays in the workspace context,
  and dated public events: `renewal`, `expansion`, `repeat_purchase`, `at_risk` or `none`, with a
  reason, a play and its sources.
- The play writes `cargo_expansion_signal`, `cargo_expansion_reason` and
  `cargo_expansion_signal_at` onto the company record id, and nothing else.
- A digest agent posts one Slack message that afternoon, at-risk first, and records the week in a
  ledger so a re-run posts nothing.

## What's inside

Adds 12 resources.

| File                                | Resource                         | Role                                                       |
| ----------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| `infra/models/crm-companies.ts`     | `defineModel` (HubSpot)          | every company, every column; the play's model              |
| `infra/models/crm-deals.ts`         | `defineModel` (HubSpot)          | every deal; the purchase history the analyst reads         |
| `infra/models/expansion-digests.ts` | `defineModel` (native)           | the digest ledger: one row per week posted                 |
| `infra/plays/flag-expansion.ts`     | `definePlay` + `defineWorkflow`  | who is judged, the judgment, the one CRM write             |
| `infra/agents/analyst.ts`           | `defineAgent`                    | the judgment, as JSON, read-only                           |
| `infra/agents/digest.ts`            | `defineAgent`                    | the weekly Slack post, channel locked                      |
| `infra/connectors/hubspot.ts`       | `defineConnector` (`hubspot`)    | source and write path                                      |
| `infra/connectors/slack.ts`         | `defineConnector` (`slack`)      | the digest's post path                                     |
| `infra/connectors/anthropic.ts`     | `defineConnector` (`anthropic`)  | the model both agents run on                               |
| `infra/folders/index.ts`            | `defineFolder` ×3                | where the models, agents and play are filed                |
| `references/expansion-plays.md`     | (not a resource)                 | the example to copy into `context/expansion-plays.md`      |

## Why a play writes and the agent does not

The agent hands back a judgment; the play persists it on the CRM record id. That keeps the write in
one reviewable place, limited to three properties, and makes a missing signal mean one thing: the
run failed.

## Placeholders (edit before deploy)

1. **The renewal window** in `infra/plays/flag-expansion.ts`, if contracts are not annual.
2. **`channelId`** in `infra/agents/digest.ts`.
3. **`languageModel`** on both agents.
4. **`context/expansion-plays.md`** in your project, from `references/expansion-plays.md`.

## What it does not do

It does not change a deal, a contact or an owner, contact a customer, or post anywhere but the
locked channel.
