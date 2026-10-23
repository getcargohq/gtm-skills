# Running the pipeline

Every command runs from the project root after the deploy. Read the uuids from the deploy output or
`cargo.state.json`: the seeds model (`model:lookalike_seeds`), the prospects model
(`model:lookalike_prospects`), the play (`play:find_lookalikes`), and the play's `workflowUuid` from
`cargo-ai orchestration play list`.

## Seeds

One row per customer the operator approved, through the native `modelUpsert` action, matched on
`domain` so a second load updates rather than duplicates:

```sh
cargo-ai orchestration action execute \
  --action '{"kind":"native","actionSlug":"modelUpsert"}' \
  --data '{"modelUuid":"<seeds-uuid>","matchingColumnSlug":"domain","matchingValue":"tailspin.example","mappings":[{"columnSlug":"customer","value":"Tailspin Freight"},{"columnSlug":"domain","value":"tailspin.example"},{"columnSlug":"relationship","value":"active"},{"columnSlug":"what_they_bought","value":"Route planning for two depots"},{"columnSlug":"deal_shape","value":"Annual, 60 vehicles"},{"columnSlug":"trigger","value":"Opened a second depot and the spreadsheet plan broke"},{"columnSlug":"signer","value":"VP Operations"},{"columnSlug":"at_purchase","value":"120 employees, 60 vehicles, family owned, one depot about to become two"},{"columnSlug":"segment_hint","value":"Regional food distribution"},{"columnSlug":"notes","value":""}]}' \
  --wait-until-finished
```

A row with only a customer and a domain still runs, and returns lookalikes of the customer as it is
today. Flag those rows to the operator before the pilot.

## Pilot

One customer through the deployed workflow, as a batch, with the play still disabled:

```sh
cargo-ai orchestration batch create --workflow-uuid <workflow-uuid> \
  --data '{"kind":"filter","modelUuid":"<seeds-uuid>","filter":{"conjonction":"and","groups":[{"conjonction":"and","conditions":[{"kind":"string","columnSlug":"domain","operator":"is","values":["tailspin.example"]}]}]},"limit":1}' \
  --wait-until-finished
```

Then read the prospects back. Storage SQL lags a write by a minute or more (the result says
`"isRefreshing": true`), so an empty result straight after the batch is the lag, not a failed run:

```sh
cargo-ai storage record list --model-uuid <prospects-uuid> --limit 20
cargo-ai orchestration run list --workflow-uuid <workflow-uuid> --limit 5
cargo-ai orchestration run get <run-uuid>
```

Check by hand:

- every company the researcher returned has a row, and every row has a final verdict
  (`not_viable`, `viable_no_contact`, `viable_email_not_verified`, `viable_contact_not_qualified` or
  `drafted`). A row stuck at `viable`, `contact_found` or `qualified` is a run that failed part way:
  read its run, fix the cause, remove the row, and it is judged again next month
- no row is a customer, a blocklisted domain, or a company outside the rubric's regions
- one `drafted` row: the urgency cites a dated source, `email_status` is `valid`, and both sentences
  of the opener are true of that company and name no customer
- one stopped row reads right against the rubric line that stopped it
- the run's actual credits, which with the number of seeds is the monthly cost to approve

Run the same customer a second time. It should return different companies or none, and every
company from the first run should be skipped at the ledger check, with no qualifier call.

## Enable

Only on an explicit yes to the monthly cost:

```sh
cargo-ai orchestration play update <play-uuid> --is-enabled true
```

The play runs every seed on the 1st of the month at 07:00 UTC. A customer added mid-month waits for
the next run, or gets its own pilot batch.
