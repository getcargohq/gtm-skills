# Inbound research

Every new inbound HubSpot contact, researched within the hour. A model extracts HubSpot contacts
every thirty minutes; a play runs on each new one that came in through an online channel; an agent
researches the person and the company and tiers it against the ICP and the tiering rubric in the
workspace context; the play writes the tier and a brief back onto the HubSpot record and posts a
note to Slack that mentions the owner.

## What it does

- Picks up each contact added since the last sync whose original source is not `OFFLINE` and that
  has never been researched.
- Researches with the workspace context and web search, and tiers the company A, B, C or
  disqualified against the rubric.
- Writes `cargo_inbound_tier`, `cargo_inbound_brief`, `cargo_inbound_rationale` and
  `cargo_inbound_researched_at` onto the contact, and seeds `cargo_tier` on the company only when it
  is blank.
- Posts one note per contact to a fixed Slack channel, mentioning the owner.

## What's inside

Adds 9 resources.

| File                                | Resource                         | Role                                                         |
| ----------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| `infra/models/crm-contacts.ts`      | `defineModel` (`fetchRecords`)   | every HubSpot contact, every column, every 30 minutes         |
| `infra/agents/researcher.ts`        | `defineAgent`                    | research and tier; returns JSON, writes nothing              |
| `infra/plays/research-inbound.ts`   | `definePlay` + `defineWorkflow`  | the filter, the HubSpot write-back, the Slack note           |
| `infra/connectors/hubspot.ts`       | `defineConnector` (`hubspot`)    | source and write target                                      |
| `infra/connectors/slack.ts`         | `defineConnector` (`slack`)      | the note                                                     |
| `infra/connectors/anthropic.ts`     | `defineConnector` (`anthropic`)  | the model the researcher runs on                             |
| `infra/folders/index.ts`            | `defineFolder` ×3                | where the model, the agent and the play are filed            |
| `context/tiering-rubric.md`         | (context file)                   | what each tier means; goes in the project context beside the ICP |
| `references/note.md`                | (not a resource)                 | the Slack note shape                                         |

## Placeholders (edit before deploy)

1. **`slackChannelId`** and **`ownerSlackIds`** in `infra/plays/research-inbound.ts`.
2. **`context/tiering-rubric.md`**, in the project context, unless account-scoring already put it
   there.
3. **`languageModel`** in `infra/agents/researcher.ts`.

## What it does not do

It does not assign or change owners, contact the lead, overwrite a tier someone already set, or
post anywhere but the fixed channel.
