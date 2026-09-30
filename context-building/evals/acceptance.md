# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `cargo-ai whoami` names the workspace, and the name was read back and matched to the company
  domain out loud.
- `npx tsx scripts/context-building/collect/crm.ts --dry-run` printed real counts (closed, won,
  lost), the pipelines and the mode. A `hypothesis` on a workspace known to have the deals means
  the wrong connection or window; `CRM` in `config.ts` pins it.
- The run without `--dry-run` wrote `cadence/log/raw/crm/<today>.json`, and the file carries real
  deal names, a lost-reason fill rate with its denominator, an association rate, stakeholders per
  deal and titles on won deals. No emails, no people's names.
- Running it a second time the same day overwrote the file with the same counts. Running it the
  next day sets `newSincePrevious.previous` to the earlier file.
- With lost deals in the window and `lostReason.filled` at 0, the real property was found in the
  CRM and `LOST_REASON_PROPERTY` was set to it.
- `npx tsx scripts/context-building/collect/jobs.ts --dry-run` printed a per-persona limit and the
  reason, read from the balance, the price and the connector's billing mode. Nothing in this
  folder states a credit amount.
- `scripts/context-building/collect/personas.ts` still holds the placeholder personas: nobody
  edited them ahead of the three-line confirmation.
- `scripts/context-building/package.json` exists in the project, and `cargo-ai cdk plan` did not
  run the CRM audit while planning.
- Exactly one `defineContext` exists in the project, the scaffold's, resolving to the root
  `context/`.
- `cargo-ai cdk check` prints `agent:context-bootstrap` and `agent:context-refresh` bound to
  `<repo>#<branch>` at the repository root. A trailing `in infra/` roots the harness where there
  is no node_modules; the collectors cannot run and the bootstrap writes from the website alone.
- `cargo-ai cdk plan` reports three agents, four bound connectors, one folder, and no model.
- Both Slack channel ids are ids (`C…`), and neither is a customer shared channel.
- `node --import tsx evals/contract.mjs` passes after every adaptation.

## The bootstrap run

- The first message read back the workspace name and domain, the mode with the won count that set
  it, what is connected and what is not, and the skip list, before any write.
- The GTM profile landed in `outputs/<date>-context-bootstrap/README.md` with every value labelled
  confirmed, inferred or unknown.
- The first stop stated the lost-reason fill rate and the deal-to-contact association rate with
  their denominators, as findings, before the three lines (or said there is no CRM).
- The first stop presented exactly three lines and asked nothing else; the material-to-ingest
  question, when asked, was asked there.
- The persona pull ran inside the printed limit; the collector's output in the pull request body
  states the spend per persona. `--over-budget` appears nowhere in the run.
- The second stop asked the persona merge/split question, the champion/signer question and the
  reference-permission question, in one message.
- Exactly one pull request, unmerged, titled `[context-building] bootstrap <date>`, touching all
  ten domains in a hypothesis-mode fresh project, and no domain on the skip list.
- Its body states files per domain, tag counts (receipted, inferred, unknown), the mode and its
  numbers, the credit spend per pull, the questions and answers, the skip list, and what was not
  connected.

## The context diff

- Every factual sentence carries `[R: …]`, `[I: …]` or `[TR: …]`; every `[R]` with a countable
  source carries the count and its denominator.
- `icp/` names at least one disqualifier. In verify mode it is derived from won versus lost and
  cites the snapshot; in hypothesis mode it is tagged `[I]`.
- Every `persona/` file has the template's headings, then `## Detection` with a title include and
  a title exclude list, `## Buying roles`, and `## Evidence` with counts. Nothing above "How we
  land" names the product.
- In verify mode every persona is reconciled with the titles on won deals or says `[TR]` where it
  is not; buying roles cite who was on won deals.
- `insight/` entries are dated, in the four buckets, with counts and denominators, `confidence:
  validated` only on two independent occurrences, and a Watch section on each.
- Every `client/` and `proof/` file carries `reference_permission: named` or `internal`.
- `alternative/` includes the status quo and in-house beside the named competitors.
- No sentence asserts an absence from missing evidence.
- The repository's context lint passes on the branch.

## The analyst

- Asked "who do we sell to and why do we lose?" in a listed channel, it answers from `context/` and
  cites the files.
- Asked something the files do not cover, it names the domain and slug it would expect instead of
  guessing.
- It repeats the evidence tag when it repeats a claim, so an inferred ICP is never quoted as fact.

## The first refresh

- The run read only calls and deals dated after the previous refresh (or the last 31 days when
  there was none), and `outputs/<date>-context-refresh/README.md` lists what it read.
- The pull request adds files under `insight/`, `objection/`, `client/`, `proof/` and `signal/`
  and modifies none under `icp/` or `persona/`. An existing objection gained at most one dated
  "Seen again" line.
- A change to `icp/` or `persona/` the evidence suggests appears in the pull request body with the
  evidence, and nowhere in the diff.
- The Slack digest is exactly five lines, its numbers match the pull request body, and the last
  line is the pull request link.
- With no new calls and no new deals, no pull request was opened and the digest said so.

## After merge

- `cargo-ai cdk deploy` syncs the changed `context/` files into the workspace context repository.
- The analyst quotes a newly merged file back when asked about its subject.
