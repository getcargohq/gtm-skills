# Acceptance

Walk every line before calling the pipeline done. Report each with its evidence: a command output,
a run link, or a pull request link. A line that could not be checked is reported as unchecked, not
as passed.

## Configuration

- `DOMAIN` in `infra/agents/web-scribe.prompt.ts` is the company's own domain, and `PAGES` are the
  site's real sections.
- `node --import tsx evals/contract.mjs` passes, run from the skill folder.

## Template and compiled graph

- `cargo-ai cdk check` prints `agent:web_scribe` bound to `<repo>#<branch>` at the repository root.
- `cargo-ai cdk plan` shows one agent, two bound connectors, one folder, and no model.

## First run

- One pull request, unmerged, titled `[web-capture] first run`, carrying
  `cadence/log/raw/web/pages/*.md` and `cadence/log/raw/web/news/<date>.json`.
- Each page file is the text `parallel.extract` returned, not a summary of it.
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
- A page whose text did not change on the site shows no diff: the verbatim rule holds.
- With nothing worth writing: no pull request.
- The news window started at the date of the last merged commit under `cadence/log/raw/web/`.
