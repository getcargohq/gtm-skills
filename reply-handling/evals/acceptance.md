# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- The sending domain in `infra/domains/outreach.ts` is a domain the workspace bought through Cargo,
  and MX, SPF and DKIM resolve for it.
- The mailbox's first name, last name and username are a real person and a valid local part, and
  `senderName` matches the From name.
- `cargo-ai mailboxManagement pricing get` was read live, the monthly figure was quoted as a
  recurring charge, and the operator approved the plan's `+ create mailbox:…` line.
- `reviewChannelId` resolves to the channel the operator named, and the Cargo app is in it.
- `reply-playbook.md` is in the project's context repo and names the sender, the offer, the ask, the
  meeting and what the sender never claims.
- `node --import tsx evals/contract.mjs` passes against the adapted graph.
- `cargo-ai project types && cargo-ai project check && cargo-ai project plan` pass in the consumer
  project, and the plan shows the play disabled.

## After deploy

- The mailbox reaches `active`, warm-up has started, and `get-send-allowance` returns a daily limit.
- The play is enabled only after that, and only for the pilot.

## The pilot

- One row for the operator's own address: the first touch arrives from the declared address and
  the row reads `waiting`.
- The operator's reply wakes the run without anyone prompting it; the context post and the review
  card land in the review channel; the row reads `pending_review` with a class, a confidence and a
  gate result.
- Every time the draft offers is one the context post lists under the slots.
- An edited approval sends the edited text in the same thread (`Re:` and the original subject,
  threaded in the mail client); the row reads `approved`, then `replied`, with
  `review_decision` `edited`.
- "Please remove me from this list" from a plus-address ends at `suppressed` before any agent node
  runs after the wait. Check the run trace; this is the check nothing else proves.
- A decline sends nothing and the row reads `declined`.

## Isolation

- This is one root skill. Its supporting Markdown lives under `references/` and `context/`, and no
  nested `SKILL.md` exists.
- The play is the only thing that sends or writes. Neither agent has a model, a tool or a native
  action in `uses`.
- No credential, deployment command, or customer data is in this repository.
- No relative import leaves the skill.
