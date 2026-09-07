---
name: reply-inbox
description: 'Give the team a hosted inbox for mailbox replies, and a LinkedIn send from the same app: a Cargo-hosted Vite app that lists threads, opens the conversation, and replies with native sendEmail. Triggers: "centralized inbox for email and LinkedIn replies", "unibox for Cargo mailboxes", "manage replies from emails and LinkedIn", "cut Lemlist for a unified inbox", "hosted inbox app for outbound replies", "stand up a reply inbox". Cargo CDK, defineApp, Cargo Hosting, sendEmail, mailbox threads, LinkedIn messageProfile. Skip when: you want an agent to hold the thread itself, which is agentic-engagement; or you want to send one email right now, which is a native sendEmail from the CLI and needs nothing deployed.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.68 or later — defineApp, plus mailboxManagement thread/message/event reads and native sendEmail. Also needs a Cargo workspace that already owns mailboxes."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/reply-inbox
metadata:
  author: getcargo
  source: cookbook
  openclaw:
    requires:
      bins:
        - cargo-ai
    install:
      - kind: node
        package: "@cargo-ai/cli@latest"
        bins:
          - cargo-ai
    homepage: https://github.com/getcargohq/gtm-skills
---

# Reply inbox

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

The team gets a URL they can live in: every reply to a Cargo mailbox in one queue, the
conversation opened, a reply that stays on the thread. LinkedIn send sits next to it when
the workspace already has a LinkedIn connection. That is a working surface, not a sequencer
and not an agent.

Two resources make it:

1. **A folder** named after this skill, kind `app`. Everything this skill deploys files there.
2. **A hosted app.** `defineApp` uploads the Vite bundle, Cargo builds it, and the live URL
   is `https://<slug>.cargo.app`. The app authenticates with Cargo OAuth and talks to the
   workspace through `@cargo-ai/api`: mailbox threads, native `sendEmail`, and — when a
   LinkedIn connector exists — `messageProfile`.

It does not provision mailboxes. It does not sync LinkedIn inbound. Replies that already
land as events on Cargo threads are what the queue is made of. LinkedIn DMs the team
sends from the app still live on LinkedIn for the other side of the conversation.

A hosted app is a recurring monthly credit charge for as long as it exists. A
`+ create app:…` line in the plan is that charge, not a one-off.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job
is to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not,
this is enough.

1. **Install it — the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/reply-inbox` writes this example to
   `infra/reply-inbox/` and this procedure to `.claude/skills/reply-inbox/`. No
   project yet?
   `cargo-ai cdk init <dir> --cookbook reply-inbox && cd <dir> && npm install` does both;
   this folder never ships a shell. **If you are reading this from the project's
   `.claude/skills/`, the install already happened — start at step 2.** On a CLI too old to have
   `add`, copy this folder in as a sibling of what is there by hand; everything below is
   unchanged.
2. **Reconcile it with what is already declared.** For every app folder this example carries
   that the project already has, rewire the imports to the existing one and drop the copy.
   Two resources with one slug is a collision at deploy. The Vite bundle at
   `infra/reply-inbox/apps/inbox/` is a nested package — leave its `package.json` in place.
3. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted (nobody asks for a variant they do not know exists); _What you will be asked_
   is the floor, and you derive before you ask. If you are asking more than about four questions
   you have skipped lookups. Record what you changed and why under a `## Decisions` section in
   your copy of this file.
4. **Plan, then stop.** `npm run check && cargo-ai cdk plan` (`check` validates the resource tree
   offline; the blank template ships it). Show the diff. A `+ create app:…` line is a monthly
   charge, not a one-off — quote the live hosting cost and get an explicit yes. Deploy only on
   that yes: `cargo-ai cdk deploy`. Never `cdk init --force` into a non-empty directory.
5. **Verify.** Walk _Done when_ line by line and report each with evidence. Deployed cleanly and
   produced a URL nobody can sign into is the normal failure — open the URL, complete Cargo
   OAuth, and send a reply to yourself before you call this done.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the ones marked
_asked_ genuinely live in the operator's head.

| Input | Kind | How it is answered | Why it matters |
| ----- | ---- | ------------------ | -------------- |
| `mailboxes` | value | **derived**: `cargo-ai mailboxManagement mailbox list`. This skill does not create inboxes. | The queue is empty until the workspace already owns at least one mailbox that has sent. Provisioning is `agentic-engagement` or the mailbox UI, not this skill. |
| `appSlug` (`infra/apps/inbox.ts`) | value | **derived**: keep `reply-inbox` unless `plan` reports the slug is taken. Ask for a unique subdomain only then. | The slug is the live host (`<slug>.cargo.app`) and must be globally unique within the hosting domain. |
| `hostingCharge` | asked | the live monthly cost of one hosted app, said out loud as a recurring charge, approved before apply | A hosted app bills every month until `destroy`. Silence is not approval of a URL. |
| `linkedinConnector` | value | **derived**: `cargo-ai connection connector list` filtered to `linkedin`. Do not ask. | The LinkedIn page is empty without a connection. That is a working empty state, not a missing resource. |

Checked before moving on, not after the deploy:

- at least one mailbox in the workspace, or the operator accepted an empty queue
- `appSlug` is unique, or the operator picked a replacement after a collision
- `hostingCharge`: the plan's `+ create app:…` line was approved as a monthly charge
- `node --import tsx evals/contract.mjs` passes against the adapted graph

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the
default.

| Variation | When it is right | How | What it costs |
| --------- | ---------------- | --- | ------------- |
| `unique-slug` | `plan` fails because `reply-inbox` is already a live subdomain | Change the first argument of `defineApp` (`infra/apps/inbox.ts`) | Cosmetic until two workspaces share a slug, in which case deploy never finishes. |
| `email-only` | The team does not send LinkedIn DMs from Cargo | Delete `src/pages/LinkedInSend.tsx` and the LinkedIn route in `src/App.tsx` | LinkedIn send disappears. Inbound LinkedIn was never here. |
| `all-threads-first` | The team wants every conversation, not only threads waiting on a reply | Default `queue` to `"all"` in `src/pages/EmailInbox.tsx` | The Needs reply filter is one click further away. Quiet threads bury the ones that are waiting. |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **A reply is native `sendEmail` with `inReplyTo` and the full `references` chain, oldest first.** (`infra/apps/inbox/src/pages/EmailInbox.tsx`, `infra/apps/inbox/src/lib/thread.ts`) Passing only the parent Message-ID is how mail clients split the conversation. Wrapping `sendEmail` in a tool is ceremony this repo refuses.
- **The app discovers mailboxes, threads and LinkedIn connectors at runtime.** (`infra/apps/inbox/src/pages/EmailInbox.tsx`, `infra/apps/inbox/src/pages/LinkedInSend.tsx`) Baking a mailbox uuid or connector uuid into `defineApp` `env` is how the app points at an inbox this workspace does not own after the next install.
- **LinkedIn inbound is not a queue in this app.** (`infra/apps/inbox/src/pages/LinkedInSend.tsx`) The LinkedIn page sends. Replies stay on LinkedIn. Claiming a unified LinkedIn inbox is a lie until Cargo stores those conversations.
- **`infra/apps/inbox/package.json` stays.** It is not decoration. The CDK loader imports every `.ts` under the project root except directories carrying a `package.json`; delete it and `cargo-ai cdk plan` tries to load React as workspace resources.
- **A hosted app is monthly until `destroy`.** (`infra/apps/inbox.ts`) There is no pause. Removing the URL is `cdk destroy` of this app, not stopping a play.
- **No credentials, deploy commands, or customer data in this repository.**

## Done when

- `cargo-ai cdk plan` reports the app folder and the hosted app, and the operator
  approved the monthly hosting line
- `node --import tsx evals/contract.mjs` passes: `defineApp(reply-inbox)` exists, files
  under an `app` folder named after this skill, and this folder declares no mailbox,
  no agent, and no tool wrapping `sendEmail`
- the live URL loads, Cargo OAuth completes, and the signed-in workspace is the one
  that owns the mailboxes
- a thread whose last event is `replied` appears under Needs reply
- a reply sent from the app lands in the same thread in the mailbox (same subject,
  `In-Reply-To` set), not as a new conversation
- if the workspace has a LinkedIn connector, a test DM from the LinkedIn page sends;
  if it does not, the page says so rather than erroring

## What it costs

A hosted app is a **monthly, recurring** charge for as long as it exists. Immediately before
the plan, look up the live hosting price for one app and say that number out loud as a
per-month cost, not a one-off. `destroy` is the only way it stops.

Each email reply is a native `sendEmail`. Run `cargo-ai orchestration action list sendEmail`
for the current per-send cost. Each LinkedIn DM is `linkedin.messageProfile` — run
`cargo-ai connection integration get linkedin` and read that action's current credits
before the first send.

This skill does not create mailboxes. If the workspace still needs inboxes, that is a
separate monthly charge owned by mailbox management, not by this app.

## Composes into

`agentic-engagement` (an agent can hold some threads; this app is where a human picks up
the rest), any play that already calls `sendEmail` (those threads are what the queue
lists).
