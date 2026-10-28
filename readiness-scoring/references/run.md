# Run

Inventory, deploy, pilot, set the lines, enable and report. Nothing in this repository deploys.

## Phase handoffs

Every message names the current phase and ends with `Next step`. A phase-boundary handoff carries
the evidence the operator needs, one concrete approval request, what approval unlocks, and what
stays blocked. An in-progress update says `No action needed` and names the next checkpoint.

## Inventory

What Account Events already holds, before anything is weighed. Read-only and free:

```sql
SELECT
  model_slug,
  event_name,
  JSON_VALUE(properties, '$.signal_type') AS signal_type,
  COUNT(*) AS events,
  COUNT(DISTINCT account_id) AS accounts,
  MAX(occurred_at) AS latest
FROM object.account_events
GROUP BY 1, 2, 3
ORDER BY events DESC
```

```sh
cargo-ai storage query execute "<the query>"
```

Each row is a candidate key for `signals` in `infra/settings.ts`: the `signal_type` when it is set
(Cargo Signals events), the `model_slug` when it is not (first-party models). The score uses the
same rule. A model the team expects and does not see here does not unify as an account event yet.

## Deploy, play disabled

1. `node --import tsx evals/contract.mjs` from this skill's folder, against the adapted resources.
2. `cargo-ai project types`, then `cargo-ai project check`, then `cargo-ai project plan` from the
   project root. Inspect every resource.
3. Confirm the plan shows `account_events` adopted (an update with its schedule, not a create), the
   feeds on a watchlist of the accounts model, `readiness_scores` as a native query model with its
   schedule, the two segments, and the play with `isEnabled: false` and `changeKinds: ["added"]`.
4. Read each feed's current per-event price (`cargo-ai connection integration get cargoSignals`) and
   give the operator the estimate described in SKILL.md, _What it costs_.
5. Deploy only on the operator's yes.

Resolve `workspaceUuid` from `cargo-ai whoami` and resource UUIDs from `cargo.state.json`. Links are
`https://app.getcargo.io/workspaces/<workspaceUuid>/<models|plays|segments>/<uuid>`.

## Pilot

The feeds deliver over the first days. Once Account Events has synced and `readiness_scores` has
rebuilt (or run the score query by hand: it is the `query` in `infra/models/readiness-scores.ts`),
read the distribution:

```sql
SELECT stage, COUNT(*) AS accounts, MIN(readiness_score) AS min_score, MAX(readiness_score) AS max_score
FROM object.readiness_scores
GROUP BY stage
```

and the top of the list:

```sql
SELECT domain, readiness_score, stage, top_signals, signal_count, last_signal_at
FROM object.readiness_scores
ORDER BY readiness_score DESC
LIMIT 20
```

Check by hand:

- every weighed type in `signals` appears in some `top_signals`; one that never does has no events
- the top ten read right to someone who knows the accounts. When they do not, change the weights
  (`weights.md`, _Checking them_), not the threshold
- an account with only old events sits below one with the same events fresh

## Set the lines

Pick `readyThreshold` so `ready_now` holds the number of accounts the team can act on in a week,
and `warmingThreshold` at about one fresh mid-weight signal below it. Edit `infra/settings.ts`,
plan, deploy, and read the distribution again at the next rebuild. A threshold set before the pilot
is a guess: on one workspace the defaults put several hundred accounts in `ready_now`.

## Enable

Set `isEnabled: true` on the play, plan, and deploy. From the next tick, every account entering
`ready_now` is posted once. The accounts already in `ready_now` are not posted
(`changeKinds: ["added"]`); if the team wants them, execute the play once by hand.

Storage SQL lags a sync by a few minutes (the result says `"isRefreshing": true`), so an empty
result straight after a deploy is the lag, not a failed model.

## Report

- the stage distribution and the thresholds chosen
- the top five accounts with their `top_signals`
- events delivered per feed over the pilot, and actual credits against the estimate
- direct Cargo links to the score model, the two segments and the play

End with one recommended `Next step`:

- the top is one signal type: lower its weight or filter its feed
- a hot account scores low: its events are missing from Account Events; find the model
- a healthy list: sequence `ready_now_accounts`, or add the account-scoring fit gate

## Complete when

- the inventory was run, and every weighed key matches it or a feed this deploy added
- the plan showed the play disabled, and the operator approved the deploy and the feed estimate
- the thresholds were set from the pilot distribution, and the top ten were read by hand
- the play is enabled and the first ready account was posted once
- the report gave the distribution, the top accounts, actual credits and one next step
