# Run

Everything from an approved search to a pipeline running on its own. Nothing
here runs before the operator approved the search in
[`search.md`](search.md).

## Deploy for the pilot of ten

The first deploy is a pilot, not the pipeline. In your copy of
`infra/models/new-hires.ts`:

- set `limit: 10`
- leave `schedule` out for now. Adding it later is a plain redeploy; removing
  a live one is not (see the model file)

Deploy with the play disabled, as it ships. Then:

1. Sync the model once and confirm ten rows landed, with
   `linkedin_profile_url` and `sales_navigator_company_url` filled:
   `cargo-ai storage column list` and a `storage query` over the model.
2. Enable the play, then execute it once: `changeKinds: ["added"]` does not
   backfill rows that landed while it was off.
3. Read every run, not a sample of them. For each of the ten, report the route,
   the status, and the CRM records written, with links.

## What the pilot has to show

- at least one run through the new-account route, with the qualifier's
  verdict and rationale, and one company it declined if the ten contain one
- every route the ten reached, with the task on the right person (the account
  owner on deals, the CSM on customers) and attached to both the account and
  the contact, and no task on known accounts
- any person found at another company was moved to the new account, not
  created twice, and the task says so
- no duplicate account: a company already in the CRM was routed as known, not
  created again. A duplicate here means the domain match needs a variant
- `no_domain` runs, if any, named with the company that had no domain

If a route never fired in the ten, say so rather than calling it verified, and
either widen the pilot or run that route on a hand-picked record.

## Open it up

On an explicit yes after the pilot:

- set `limit` back to 2,500 (or the approved value per URL)
- add the cadence the operator chose. The default is every two weeks, the 1st
  and the 15th; on demand means no schedule and a manual sync
- redeploy, then sync once. Only the people new since the pilot create runs

## Report

Per sync: people extracted, people added, runs by route and status, accounts
created, contacts created, tasks raised, companies the qualifier declined, and
spend against the estimate. A sync that added people and raised no task is a
failure to investigate, not a quiet week.

## Links

- model: `https://app.getcargo.io/workspaces/<workspace>/models/<model-uuid>`
- play: `https://app.getcargo.io/workspaces/<workspace>/plays/<play-uuid>`
- qualifier: `https://app.getcargo.io/workspaces/<workspace>/agents/<agent-uuid>`
