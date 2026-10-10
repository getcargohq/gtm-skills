# Meeting prep

A briefing card in Slack the moment an external meeting is booked. Google Calendar wakes one plain
agent for each meeting created, moved or cancelled; the agent researches it from the shared `gtm_`
native models, the workspace context and the web, posts one card to a locked channel mentioning the
organizer, and threads reschedules and cancellations under it.

## What it does

- Watches every calendar in the Google Workspace (domain-wide delegation), or one person's (OAuth).
- Wakes only for meetings with someone outside the company.
- Posts one card per meeting on booking: who is joining, the open deal, the quoted line from last
  time, one recent public event, and a call tip grounded in your positioning.
- Threads a short reply when the time, an outside attendee or the title changes, and when the
  meeting is cancelled. Anything else posts nothing.
- Treats the invite's description as data: it never follows instructions written in it.

## What's inside

Adds 10 resources, and needs no CRM.

| File                                  | Resource                             | Role                                                         |
| ------------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| `infra/agents/briefer.ts`             | `defineAgent`                        | the calendar trigger, the model reads, the locked Slack post |
| `infra/agents/briefer.prompt.ts`      | (not a resource)                     | created, updated, cancelled: what each does                  |
| `infra/connectors/google-calendar.ts` | `defineConnector` (`googleCalendar`) | the trigger and the event re-read                            |
| `infra/connectors/slack.ts`           | `defineConnector` (`slack`)          | the organizer lookup and the post path                       |
| `infra/connectors/anthropic.ts`       | `defineConnector` (`anthropic`)      | the model the agent runs on                                  |
| `infra/models/gtm-accounts.ts`        | `defineModel` (`defineAccount`)      | the companies, matched on the attendee's email domain        |
| `infra/models/gtm-contacts.ts`        | `defineModel` (`defineContact`)      | the people, matched on email                                 |
| `infra/models/gtm-opportunities.ts`   | `defineModel` (`defineDeal`)         | the open deal on the account                                 |
| `infra/models/gtm-activities.ts`      | `defineModel` (native custom)        | past meetings, calls, emails and notes per account           |
| `infra/folders/index.ts`              | `defineFolder` ×2                    | where the agent and the models are filed                     |
| `references/card.md`                  | (not a resource)                     | the card, the thread replies, and the rule for each line     |

## Why a calendar trigger and not a morning run

A morning run misses the meeting booked at 9:55 for 10:00, briefs everything at once whether it is
in an hour or in a week, and needs a ledger to avoid posting twice. The trigger fires once per
change, opens one conversation per event, and that conversation is the record: the agent sees its
own card above every update, so it threads instead of re-posting and needs no model of its own.

## Why the shared gtm_ models

They are the same `gtm_accounts`, `gtm_contacts`, `gtm_opportunities` and `gtm_activities` every
pipeline here declares, so a project that also runs, say, `stalled-deal-nudge` keeps one model of
each. A team on HubSpot, Salesforce or Attio swaps them for connector-backed ones (`crm-backed` in
`SKILL.md`); the prompt only needs its column names mapped.

## Placeholders (edit before deploy)

1. **The Google Calendar connector**: domain-wide delegation for the team, or OAuth for one person.
2. **`userScope`** on the trigger: `"all"`, or `"selected"` with the sales team's emails in `users`.
3. **`channelId`** in `infra/agents/briefer.ts`: the Slack channel id the cards land in.
4. **`languageModel`**: any Anthropic model the workspace's connector can reach.

## What it does not do

It does not write to the calendar or to the `gtm_` models, email or message a prospect, post
anywhere but the locked channel, or edit the workspace context.
