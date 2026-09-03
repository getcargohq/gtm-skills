# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- The collector was run by hand once (`CALL_RECORDER_API_KEY=… npx tsx
  scripts/call-capture/collect/calls.ts`) and wrote real raw files into
  `cadence/log/raw/calls/`, each carrying a `source:` uuid.
- Running it a second time wrote nothing. If it re-captured the same calls, the dedup key and the
  `source:` line have drifted apart and every run will duplicate the window.
- The transcript response shape was checked against the live API, not assumed. A wrong field name
  here produces a clean, empty run every morning rather than an error.
- `CALL_CAPTURE_INTERNAL_DOMAIN` is the company's real domain, and an internal-only call in the
  window was **not** captured.
- `scripts/call-capture/package.json` exists in the project, and `cargo-ai cdk plan` did not
  hit the recorder's API while planning. If it did, that file is missing and the loader is importing
  the collector.
- Exactly one `defineContext` exists in the project, resolving to the `context/` directory at the
  repository root.
- `cargo-ai cdk check` prints `agent:call-scribe bound to <repo>#<branch>` with no trailing
  subdirectory. The repo is the one holding `context/` and `cadence/`, and the grant can push to it.
  A trailing `in infra/` means the harness was rooted at the CDK project rather than at the
  package.json that declares `@cargo-ai/cdk`: that directory has no node_modules, so `npx tsx`
  cannot run the collector at all.
- `CALL_RECORDER_API_KEY` is set in the deploy environment and appears in no committed file.
- The cadence paths in the system prompt match what `cadence/README.md` describes, or the new folders
  are introduced deliberately and that README is updated to name them.

## First scheduled run

- Exactly one pull request, unmerged, titled `[cadence] scribe <date>`.
- Its body reports four numbers: captured, scribed fresh, scribed from backfill, pending remaining.
- Every scribed call has exactly one entry under `cadence/log/calls/`, each carrying the recorder's
  uuid in frontmatter.
- No raw capture was edited, moved or deleted.
- Re-running the agent the same day opens no duplicate entry for any call already scribed.
- No entry invents an attendee, a quote or a figure absent from the transcript. Spot-check two
  entries against their recordings; this is the check nothing automated can do for you.
- A call where the company was the buyer rather than the seller is filed as vendor intel and appears
  nowhere as pipeline or expansion.

## The context diff

- Every `context/` file in the diff cites two or more independent occurrences, by log path.
- No file in the diff cites only one occurrence.
- Changes prefer updating an existing file over creating a near-duplicate; a new file restating an
  existing one under a different name is a failure of the domain lookup, not of the bar.
- Every new or changed file carries the frontmatter `context/README.md` requires, and the
  repository's context lint passes.
- Nothing under `plan/` or `infra/` is touched.

## After merge

- `cargo-ai cdk deploy` syncs the changed `context/` files into the workspace context repository.
- An agent with the `context` capability quotes the changed file back when asked about its subject.

## Over the first two weeks

- The pending remainder in the pull request body falls run over run. A flat or rising remainder means
  the cap is too low, or a class of call is failing to parse and being silently reselected every
  morning — check the same uuids are not reappearing.
- The raw archive grows by roughly the number of external calls actually held. A day with calls and
  no captures means the readiness flags or the window are wrong.
- At least one claim was promoted into `context/` on its second occurrence, and at least one stayed
  in a log entry because it only ever occurred once. If everything is being promoted, the bar is not
  being applied.
