# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Queue

- The Hot leads query in `infra/apps/cockpit/src/lib/queries.ts` names tables and columns that
  `cargo-ai storage dataset list` and `column list` returned in this workspace. None was guessed.
- It was run by hand before the deploy, and its rows were shown to the operator.

## Senders

- Every rep in `infra/members/reps.ts` is a revenue-organization member under the exact email they
  sign in with.
- Every mailbox is on an active domain that is not the company's primary domain.
- The operator approved each mailbox's monthly price, quoted from
  `cargo-ai mailboxManagement pricing get`.

## Project

- The agent installed and read `cargo-project` before adapting.
- `gtm_accounts`, `gtm_contacts` and `gtm_activities` are each declared once in the project, as in
  `scripts/native-models.json`.
- The claim is one tool run: account, people search, contact, email lookup, draft, claim marked
  ready. The app never calls a connector action itself.
- The send is one tool run: `sendEmail`, the draft marked sent, one `gtm_activities` row.
- No play, schedule or bulk action sends email.
- The writer agent has read-only context, no web search and no model in `uses`.
- The app reads the tool and model ids from `defineApp` `env`, never from a hard-coded uuid.
- `node --import tsx evals/contract.mjs`, `npm run type:check` in the app, `cargo-ai project types`,
  `cargo-ai project check` and `cargo-ai project plan` pass.

## Pilot

- One claim reached `ready`, with a draft per sourced person, and the drafts were read by hand.
- One send to an address the operator owns arrived with the unsubscribe link, and both writes
  landed.
- The per-claim cost from the pilot run was given to the operator.

## Guided handoff

- Every substantive message names the current phase and ends with a `Next step` containing one
  concrete action.
- Nothing is deployed, and no mailbox is created, without the operator's yes on the plan.
