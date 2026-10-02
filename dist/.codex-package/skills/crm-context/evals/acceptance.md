# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- `cargo-ai whoami` names the workspace, and the name was read back and matched to the company
  out loud.
- `npx tsx scripts/crm-context/collect/crm.ts --dry-run` printed real counts (closed, won, lost),
  the pipelines and the mode. A `hypothesis` on a workspace known to have the deals means the
  wrong connection or window; `CRM` and `WINDOW_DAYS` in `config.ts` pin them.
- The run without `--dry-run` wrote `cadence/log/raw/crm/<today>.json`, and the file carries real
  deal names, a lost-reason fill rate with its denominator, an association rate, stakeholders per
  deal and titles on won deals. No emails, no people's names, no amounts in what the agent writes.
- Running it a second time the same day overwrote the file with the same counts. Running it the
  next day sets `newSincePrevious.previous` to the earlier file.
- With lost deals in the window and `lostReason.filled` at 0, the real property was found in the
  CRM and `LOST_REASON_PROPERTY` was set to it.
- With more than one pipeline in the snapshot, `PIPELINES` in `config.ts` names the sales ones, or
  the first pass's pull request carries the question.
- `scripts/crm-context/package.json` exists in the project, and `cargo-ai cdk plan` did not run the
  audit while planning.
- Exactly one `defineContext` exists in the project, the scaffold's, resolving to the root
  `context/`.
- `cargo-ai cdk check` prints `agent:win_loss_analyst` bound to `<repo>#<branch>` at the repository
  root. A trailing `in infra/` roots the harness where there is no node_modules; the audit cannot
  run and the month reports clean and empty.
- `cargo-ai cdk plan` reports one agent, three bound connectors, one folder, and no model.
- The Slack channel id is an id (`C…`), and it is not a customer shared channel.
- `node --import tsx evals/contract.mjs` passes after every adaptation.

## The first pass

- The pull request body opens with the two hygiene findings, with denominators, then the mode
  and the won count that set it.
- With the fill rate under half, no `objection/` file was written and the body says why.
- `icp/` either gained a dated "Verified against the CRM" section (seeded before) or was written
  (empty before); either way it names a disqualifier derived from won versus lost and cites the
  snapshot.
- `insight/` holds dated files in the three buckets (who we talk to, where we win, where we lose),
  each with counts and denominators, a Watch section, and `confidence: validated` only on two or
  more deals in verify mode.
- Every title on a won deal is either mapped to the `persona/` file that detects it or listed as
  undetected, with the count of deals it appears on.
- `client/` has one file per closed-won account, `reference_permission: unknown`, no amount.
- Nothing under `persona/` changed. A proposed change, if any, is in the pull request body with
  deal ids.
- Exactly one pull request, unmerged, titled `[crm-context] first pass <date>`; the Slack digest is
  five lines, its numbers match the snapshot, and the last line is the pull request link.

## A monthly run

- The run read only the deals in `newSincePrevious`, and `outputs/<date>-crm-context/README.md`
  lists their ids.
- The pull request adds files and modifies none under `icp/` or `persona/`. An existing objection
  gained at most one dated "Seen again" line.
- With nothing new, no pull request was opened and the digest said so.

## After merge

- `cargo-ai cdk deploy` syncs the changed `context/` files into the workspace context repository.
- An agent with the `context` capability quotes the verified ICP section back, with its tag.
