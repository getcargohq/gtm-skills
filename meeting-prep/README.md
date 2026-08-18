# Meeting prep assistant

A briefing card before every intro call, in Slack, unattended.

Generalized from the "Discovery Call Briefer" running in production at Unikraft,
so the shape here is not theoretical: it is what survived contact with real reps.

## What it does

- Wakes every weekday morning, finds today's calls in the CRM, and posts one
  skimmable card per meeting before it starts.
- Each card: when, the company snapshot, who is joining (with real LinkedIn
  profiles), the warmest engagement signal per attendee quoted verbatim, and a
  tailored call tip ending in one probing question.
- Never posts a duplicate, even when re-run.
- Says "no calls today" once, rather than posting nothing or posting noise.

## The three things that make or break it

1. **The dedupe.** An agent that posts a second card for the same meeting gets
   muted within a week. The agent checks the `meeting_briefs` ledger _before_ it
   researches (research costs credits) and appends to it _after_ a successful
   post (so a failed post can be retried).
2. **No fabrication, especially LinkedIn URLs.** A made-up profile link is worse
   than no link: the rep clicks it in front of the prospect. The agent is told to
   say "no profile found" instead.
3. **The company context block.** It is a placeholder in the system prompt, and it
   is what separates a sharp call tip from a generic one. Write it with the care
   you would give positioning copy: what you are, what you never claim, and where
   you genuinely win.

## A deliberate deviation from the original

The production version deduped by **reading the Slack channel back** and looking
for a marker per meeting id. That cannot be built here: Cargo's Slack integration
exposes exactly one action, `postMessage`. There is no read-history action.

So the dedupe is a native ledger model instead (`meeting_briefs`). This is the
sturdier mechanism anyway. Reading a chat channel to discover what you have
already done is a workaround for not having state; the ledger _is_ state, and it
survives a channel rename, an archived message, and someone deleting the card.

## What's inside

Adds 2 resources, and uses the CRM connector in `connectors/hubspot.ts`.

| File                | Resource      | Role                                                   |
| ------------------- | ------------- | ------------------------------------------------------ |
| `models/briefs.ts`  | `defineModel` | the dedupe ledger: one row per meeting already briefed |
| `agents/briefer.ts` | `defineAgent` | finds, dedupes, researches, posts, records             |

## Placeholders (edit before deploy)

1. **The company context block** in `agents/briefer.ts`. The most important edit
   in this skill. Three lines: what you are, what you never claim, best-fit
   workloads and angles.
2. **The meeting type.** The agent searches the CRM for today's meetings. Tell it
   which activity type counts as an intro or discovery call: your CRM's property
   names are yours, not ours.
3. **Slack channel and email recipients.** Where the cards land.
4. **The cron**, default 07:00 on weekdays. Early enough to land before the first
   call of the day.
5. **Language model.** A reasoning-grade model. Sonnet-class works well here.

## Email mirror

The card is posted to Slack first. To mirror it by email, add an email connector
(`resend` or `Sendgrid`, both key-based: set the key in `.env`) and give the agent
its `sendEmail` action. Slack is the primary channel because that is where the
card is actually read; email is the backup for reps who live in their inbox.

## Done when

A booked test meeting produces **exactly one card** before the call, re-running
the agent produces **zero duplicates**, and nothing in the card is fabricated
(every LinkedIn URL resolves, every quoted signal exists).

## Composes into

`research-agent` (deeper account briefs), `account-scoring` (know the tier before
the call), and `signal-based-tam` (the signals the card quotes).
