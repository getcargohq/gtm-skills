# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `cargo-ai mailboxManagement mailbox list` shows at least one mailbox, or the operator
  accepted that the queue will be empty until they send.
- The `defineApp` slug is unique, or the operator changed it after a collision.
- The live monthly hosting cost of one app was quoted and the operator approved the
  plan's `+ create app:…` line.
- `node --import tsx evals/contract.mjs` passes against the adapted graph.
- `cargo-ai cdk types && cargo-ai cdk check && cargo-ai cdk plan` pass in the consumer project.

## After deploy

- The live URL from `defineApp` loads.
- Cargo OAuth completes against the workspace that owns the mailboxes.
- `infra/apps/inbox/package.json` is still present in the project.

## The queue

- A first send from a Cargo mailbox (play, CLI, or `agentic-engagement`) creates a thread.
- A reply to that send appears under Needs reply.
- A reply sent from the app lands in the same thread: same subject (`Re: …`),
  `In-Reply-To` set, full `references` chain. It does not appear as a new conversation.
- After that send, the thread leaves Needs reply (last event is `sent`).

## LinkedIn

- With a LinkedIn connector: a test DM from the LinkedIn page sends.
- Without one: the page explains that, and does not error.

## Isolation

- This is one root skill. Its supporting Markdown files live under `references/`, and no
  nested `SKILL.md` exists.
- Native `sendEmail` from the app is the only email send path. No play or tool in this
  folder wraps it.
- No credential, deployment command, or customer data is in this repository.
- No relative import leaves the skill.
