# Acceptance

Walk every line before calling the pipeline done. Report each with its evidence: a command output,
a run link, or a pull request link. A line that could not be checked is reported as unchecked, not
as passed.

## Before deploy

- `node --import tsx evals/contract.mjs` passes, run from the skill folder.
- The project holds exactly one `crm` connector and one each of `crm_accounts` and `crm_contacts`;
  copies this cookbook brought were dropped where another cookbook already declares them.
- `LOST_REASON_COLUMN` in the prompt names the portal's lost-reason property, and no model's config
  filters or picks columns.
- The Slack channel id is an id, not a name, and not a customer shared channel.
- `cargo-ai project check` prints `agent:win_loss_analyst` bound to `<repo>#<branch>` at the repository
  root, and `cargo-ai project plan` shows the agent, the models, the bound connectors and two folders.

## After the models sync

- The `pipelines` query, run by hand, returns non-zero won and lost counts.
- `crm_deals` holds open deals too, and the `pipelines` counts match the closed deals the team
  knows about: the queries, not the model, narrow to closed.

## The first pass

- Exactly one pull request, unmerged, titled `[win-loss-review] first pass <date>`; the Slack digest
  is posted once, five lines, ending with its link.
- The body opens with the two hygiene findings, each with its denominator, then the mode and the won
  count that set it.
- `outputs/<date>-win-loss-review/README.md` holds each query's result, counts and ids only, no
  amount and no email.
- `icp/` carries a disqualifier, as a new file or one dated section appended to the seeded one.
- `insight/` holds dated files in the three buckets; every title at a won account is mapped to a
  persona or listed as undetected, and the file says the titles are at the accounts, not only on
  the deals.
- With the fill rate under half, no `objection/` file exists and the body says why.
- Every `client/` file carries `reference_permission: unknown` and no amount.
- Nothing under `persona/` changed.

## A monthly run

- It read the deals closed since the date of the last merged run record.
- With new deals: a pull request that adds files and modifies none under `icp/` or `persona/`, and
  never touches `context/icp/scoring.md`.
- With none: no pull request, and the digest says so.

## The scoring pass

- It stopped three times, and the run record holds each answer: the audit and window confirmed, the
  Tier 1 list confirmed after the four questions, the 10-account cost approved.
- The window was read from the deals' sales cycle (12 months unless cycles run past a year), or the
  run record says the operator gave it.
- Tier 1 is written in relative terms with no amount, and no outcome field filled for under about
  60% of customers is in the rule.
- `outputs/<date>-win-loss-scoring/` holds the run record, `evidence.csv` and numbered scripts, with
  no amount, no email and no person; raw responses sit under `~/.cache/win-loss-scoring/`, not in
  the repository.
- `context/icp/scoring.md` has the sections and model block of `references/scoring-format.md`:
  weights summing to 100, every attribute with a `get` a non-customer can answer, `unknown` at half
  the weight, modifiers outside the 100.
- Every filter and attribute carries an evidence line naming both groups and the sample, and says
  whether it held in the period before; every dropped candidate is listed with its reason.
- A script run over the block on the cohort reproduces the band counts in the run record, and most
  Tier 1 accounts land in Strong.
- One pull request titled `[win-loss-review] scoring model <date>`, unmerged.

## After merge

- The verified ICP section and `scoring.md` are readable from the workspace context repository
  after `cargo-ai project deploy`, and an agent with the `context` capability quotes them back.
