# Inbound research

Every new inbound contact, researched within fifteen minutes. Contacts land in a Cargo native
`people` model from a form, a webhook, an upload or another pipeline; a play runs on each
new one whose `lead_source` is an inbound source; an agent researches the person and the company
and tiers it against the ICP and the tiering rubric in the workspace context; the play writes the
tier and a brief back onto the row and posts a note to Slack that mentions the owner. No CRM is
needed. Running HubSpot, Salesforce or Attio is the `crm-backed` variation in `SKILL.md`.

## What it does

- Picks up each contact added since the last tick whose `lead_source` is on the allow-list and that
  has never been researched.
- Researches with the workspace context and web search, and tiers the company A, B, C or
  disqualified against the rubric.
- Writes `inbound_tier`, `inbound_brief`, `inbound_rationale` and
  `inbound_researched_at` onto the contact, and seeds `tier` on the linked account only
  when it is blank.
- Posts one note per contact to a fixed Slack channel, mentioning the owner.

## What's inside

Adds 9 resources.

| File                              | Resource                        | Role                                                             |
| --------------------------------- | ------------------------------- | ---------------------------------------------------------------- |
| `infra/models/people.ts`        | `defineModel` (native contact)  | the inbound contacts, plus the four columns the play writes      |
| `infra/models/companies.ts`        | `defineModel` (native account)  | their accounts, plus `tier` and `tier_reason`        |
| `infra/agents/researcher.ts`      | `defineAgent`                   | research and tier; returns JSON, writes nothing                  |
| `infra/plays/research-inbound.ts` | `definePlay` + `defineWorkflow` | the filter, the write-back, the Slack note                       |
| `infra/connectors/slack.ts`       | `defineConnector` (`slack`)     | the note                                                         |
| `infra/connectors/anthropic.ts`   | `defineConnector` (`anthropic`) | the model the researcher runs on                                 |
| `infra/folders/index.ts`          | `defineFolder` ×3               | where the models, the agent and the play are filed               |
| `context/tiering-rubric.md`       | (context file)                  | what each tier means; goes in the project context beside the ICP |
| `references/note.md`              | (not a resource)                | the Slack note shape                                             |

## How contacts get in

The pipeline starts at a new row in `people`. What writes that row is yours: a form or
webhook posting into the model, a CSV upload, `cargo-ai storage record create`, or another pipeline.
Whatever it is, it sets `lead_source` to a value on the play's allow-list.

## Placeholders (edit before deploy)

1. **`slackChannelId`** and **`ownerSlackIds`** in `infra/plays/research-inbound.ts`.
2. **The `lead_source` allow-list** in the same file.
3. **`context/tiering-rubric.md`**, in the project context, unless account-scoring already put it
   there.
4. **`languageModel`** in `infra/agents/researcher.ts`.

## What it does not do

It does not assign or change owners, contact the lead, overwrite a tier someone already set, or
post anywhere but the fixed channel.
