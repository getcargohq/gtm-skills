# Agentic engagement

An agent that holds email conversations with leads from a mailbox the workspace
owns. A sending domain, an inbox, a native email trigger on reply and
unsubscribe, and a heartbeat that checks thread status when nothing inbound
happened — that is the loop.

## What it does

- **Owns the inbox.** `defineDomain` plus `defineMailbox` provision (or adopt)
  the From address the lead sees. The mailbox is a recurring monthly charge.
- **Sends through one tool.** An agent cannot call `sendEmail` directly. The
  send-email tool pins the mailbox uuid so every send is from that inbox, and
  so the native trigger knows which chats to wake.
- **Wakes on inbound status.** `agentNativeTrigger({ agentSlug: "email",
  config: { kinds: ["replied", "unsubscribed"] } })` continues the thread or
  stops it. Opens and clicks do not write back.
- **Checks silence.** A `heartbeat` re-wakes the same chat so the agent can
  read a thread that stayed at `sent`. At most one unanswered follow-up.
- **Stops.** Unsubscribe, "not interested", or a request for a human ends the
  loop. A second unanswered send is a sequence; this agent is not one.

## How it works

```mermaid
flowchart TD
    domain["defineDomain"] --> mailbox["defineMailbox"]
    mailbox --> tool["send-email tool<br/>pins mailbox uuid"]
    tool --> agent["engager"]
    agent -->|"first send, or a play calls it"| send["sendEmail"]
    send --> thread["thread"]
    thread -->|"status: replied or unsubscribed"| trigger["native email trigger"]
    trigger --> agent
    thread -->|"status still sent"| beat["heartbeat<br/>status check"]
    beat --> agent
```

1. **First outbound.** A human chats with the engager, or a play calls it with
   a lead. The agent sends through the send-email tool. That send belongs to
   this agent, which is what the trigger later keys off.
2. **Inbound status.** IMAP picks up a reply; `List-Unsubscribe` records an
   opt-out. The native trigger wakes the same chat.
3. **Silence.** If the thread stays at `sent`, the heartbeat re-wakes the chat
   so the agent can check that status. One follow-up, then stop.
4. **The agent sends at most once per wake**, passing `inReplyTo` and the full
   `references` chain so the thread stays a thread.

Adds 4 resource kinds plus the folders they file into.

| File | Resource | Role |
| ---- | -------- | ---- |
| `infra/domains/outreach.ts` | `defineDomain` | sending domain the mailbox lives on |
| `infra/mailboxes/rep.ts` | `defineMailbox` | the From inbox; monthly charge |
| `infra/tools/send-email.ts` | `defineTool` | the only send path; pins the mailbox |
| `infra/agents/engager.ts` | `defineAgent` | conversation agent + native email trigger + heartbeat |
| `infra/agents/engager.prompt.ts` | (not a resource) | when to reply, how to thread, when to stop |
| `infra/connectors/openai.ts` | `defineConnector` | the LLM the engager talks through |
| `infra/folders/agentic-engagement.ts` | `defineFolder` | mailbox / tool / agent folders named after the skill |

## Why the tool is not a wrapped action

A tool whose body is one connector call is ceremony, and this repo refuses
those. `sendEmail` is different: it is a native action an agent cannot call,
and the tool is the binding that pins `mailboxUuid` so the trigger and the send
agree on one inbox. Take that pin out and the loop silently splits.

## Placeholders (edit before deploy)

1. **Sending domain** — `infra/domains/outreach.ts`: the domain the workspace
   owns. Keep `adopt: true` if it was bought in the UI; drop it only to
   register a new one.
2. **Mailbox identity** — `infra/mailboxes/rep.ts`: username, first name, last
   name of a real person. Type defaults to `google`.
3. **Language model** — `infra/agents/engager.ts`.

## What it does not do

It does not blast a list, start warm-up (that is a CLI call after deploy),
merge DNS, write to a CRM, or invent a first send from a reply trigger or a
heartbeat. First outbound is a chat or a play that calls this agent; this
skill is the loop after that.
