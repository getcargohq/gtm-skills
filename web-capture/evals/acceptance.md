# Acceptance

Walk every line before calling the pipeline done. Report each with its evidence: a command output,
a run link, or a pull request link. A line that could not be checked is reported as unchecked, not
as passed.

## Configuration

- `DOMAIN` in `scripts/web-capture/collect/config.ts` is the company's own domain, and `PAGES` are
  the site's real sections.
- `npx tsx scripts/web-capture/collect/web.ts --dry-run` printed that domain, those pages and the
  news window.
- `scripts/web-capture/package.json` exists in the project, and `cargo-ai cdk plan` did not run the
  collector.

## Template and compiled graph

- `node --import tsx evals/contract.mjs` passes, run from the skill folder.
- `cargo-ai cdk check` prints `agent:web_scribe` bound to `<repo>#<branch>` at the repository root.
- `cargo-ai cdk plan` shows one agent, two bound connectors, one folder, and no model.

## First run

- One pull request, unmerged, titled `[web-capture] first run`, carrying
  `cadence/log/raw/web/<date>.json`.
- Every domain that was empty is seeded; no existing file changed.
- Every factual sentence carries `[R: <url>]`, `[I: ...]` or `[TR: ...]`.
- `icp/` names at least one disqualifier and says the CRM verifies it later.
- Every `client/` file carries `reference_permission: unknown`; every `proof/` file cites its
  `client/` file and its URL.
- No `persona/` or `jtbd/` file was written.

## A later week

- With a change: one pull request adding `insight/<date>-web.md`, one tagged line per finding,
  new `client/` or `alternative/` files only for newly named customers or competitors, and any
  edit to an existing file proposed in the body, not made.
- With nothing worth writing: no pull request, and the run printed the collector's counts.
- The news window started at the last committed snapshot's date.
- The body states the spend the collector reported.
