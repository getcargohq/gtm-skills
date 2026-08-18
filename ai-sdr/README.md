# AI SDR

Go from an account to a sent first-touch — written by AI, enrolled into an
Email Bison campaign. This is the "put it all together" skill.

## What it does

- Sources contacts for each account (via `contact-sourcing`).
- Researches each account into a brief (via `research-agent`).
- A copywriter agent turns the brief into a short first-touch message.
- Saves the copy to the CRM record and enrols the contact in an Email Bison
  campaign that sends the AI body.
- Posts each send to a Slack ops channel with a link to the lead.

## How it works

1. **Source contacts.** `contact-sourcing` finds people for an account and adds
   them to the base `contacts` model.
2. **Research the account.** For each new contact, `research-agent`'s
   `account-brief` tool produces a brief.
3. **Write the copy.** The `sdr-copywriter` agent turns that brief into a short
   first-touch message.
4. **Enrol and send.** The `send-outreach` play stamps `outreach_draft` on the
   CRM record, upserts the contact as an Email Bison lead (the copy rides along
   as the `outreach_draft` custom variable), and imports it into a campaign.
5. **Notify.** The play posts the send to a Slack ops channel, linking the lead.

Adds 3 resources of its own (an agent, a connector, and a play) — everything
else is composition of three other skills, which is the whole point.

## Placeholders (edit before deploy)

1. **Voice and rules** — the copywriter reads the context repo
   (`gtm-knowledge-graph/context/`): outreach rules live there, not in code.
2. **Email Bison instance** — set `EMAIL_BISON_API_KEY` and the connector's
   `domain` in `connectors/email-bison.ts`; match `BISON_APP_URL` in the play.
3. **Campaign** — `plays/send-outreach.ts` `campaignId` (the campaign whose email
   step references `{{outreach_draft}}`).
4. **Ops channel** — `plays/send-outreach.ts` `channelId`.
5. **Eligibility filter** — the play ships as "has an email"; tighten it to your
   outreach-eligible slice.
6. **Custom variable** — `outreach_draft` must exist in the Email Bison workspace
   (custom variables are created in advance) and `outreach_draft` must exist as a
   CRM contact property.

## Done when

Add a test account → sourcing writes contacts → for each one, a run produces
a brief-grounded message under 90 words, stamps it on the CRM record, enrols the
contact in the Email Bison campaign, and posts the send to the ops channel, with
the evaluator scoring ≥ 0.8.
