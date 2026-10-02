# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `cargo-ai whoami` names the workspace, and the name was read back and matched to the company
  domain out loud.
- `npx tsx scripts/context-seeding/collect/jobs.ts --dry-run` printed a per-persona limit and the
  reason, read from the balance, the price and the connector's billing mode. Nothing in this
  folder states a credit amount.
- `scripts/context-seeding/collect/personas.ts` still holds the placeholder personas: nobody
  edited them ahead of the three-line confirmation.
- `scripts/context-seeding/package.json` exists in the project, and `cargo-ai cdk plan` did not
  call TheirStack while planning.
- Exactly one `defineContext` exists in the project, the scaffold's, resolving to the root
  `context/`.
- `cargo-ai cdk check` prints `agent:context_seeder` bound to `<repo>#<branch>` at the repository
  root. A trailing `in infra/` roots the harness where there is no node_modules; the collector
  cannot run and the run writes from the website alone.
- `cargo-ai cdk plan` reports one agent, three bound connectors, one folder, and no model.
- `node --import tsx evals/contract.mjs` passes after every adaptation.

## The run

- The first message read back the workspace name and domain, the mode (chat or setup) and the
  skip list, before any write.
- The GTM profile landed in `outputs/<date>-context-seeding/README.md` with every value labelled
  confirmed, inferred or unknown.
- Chat mode: the first stop presented exactly three lines and asked nothing else but the
  material-to-ingest question; the second stop asked the persona merge/split and the
  reference-permission questions in one message. Setup mode: both stops are a "Questions for the
  reviewer" section in the pull request body, with the candidates, and nothing was asked.
- The persona pull ran inside the printed limit; the collector's output in the pull request body
  states the spend per persona. `--over-budget` appears nowhere in the run.
- Exactly one pull request, unmerged, titled `[context-seeding] <domain> <date>`, touching
  `global/`, `icp/`, `persona/`, `jtbd/`, `alternative/`, `client/`, `proof/` and `signal/` in a
  fresh project, and no domain on the skip list.
- Its body states files per domain, tag counts (receipted, inferred, unknown), the credit spend
  per pull, the questions and answers (or the reviewer section), and the skip list.

## The context diff

- Every factual sentence carries `[R: <url>]`, `[I: …]` or `[TR: …]`; every `[R]` with a
  countable source carries the count and its denominator.
- `icp/` names at least one disqualifier and says in its Source section that a CRM-reading
  cookbook verifies or replaces it.
- Every `persona/` file has the template's headings, then `## Detection` with a title include and
  a title exclude list, `## Buying roles`, and `## Evidence` with counts. Nothing above "How we
  land" names the product.
- Every `client/` and `proof/` file carries `reference_permission: named`, `internal` or
  `unknown` (setup mode).
- `alternative/` includes the status quo and in-house beside the named competitors.
- Every `proof/`, `signal/` and `icp/` claim is `confidence: hypothesis`: public sources count as
  one source.
- No sentence asserts an absence from missing evidence, and no file cites a CRM, a call or a Slack
  message.
- The repository's context lint passes on the branch.

## After merge

- `cargo-ai cdk deploy` syncs the seeded `context/` files into the workspace context repository.
- An agent with the `context` capability quotes a seeded file back when asked about its subject,
  with its tag.
