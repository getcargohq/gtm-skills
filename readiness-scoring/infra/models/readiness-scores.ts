import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";
import {
  horizonDays,
  readyThreshold,
  signals,
  warmingThreshold,
} from "../settings";

// One CASE per setting, so a signal type maps to its weight and its half-life.
// A type not in `signals` falls to ELSE 0 and is filtered out before the sum.
const signalTypes = Object.keys(signals);

const weightCase = `case signal_type ${signalTypes
  .map((type) => `when '${type}' then ${signals[type].weight}`)
  .join(" ")} else 0 end`;

const halfLifeCase = `case signal_type ${signalTypes
  .map((type) => `when '${type}' then ${signals[type].halfLifeDays}`)
  .join(" ")} else 1 end`;

// The score, as BigQuery SQL over the workspace's own models:
//
//   score = sum over the account's events of
//           weight × 0.5 ^ (age in days / half-life in days)
//
// written as exp(-ln(2) × age / half-life). Read from the inside out:
//
//   events         every Account Events row inside the horizon, its signal
//                  type (the Cargo Signals `signal_type` in `properties`, or
//                  the source model's slug for an event that has none), and
//                  its age in days now. One row per account, type and day:
//                  the same round reported by two feeds, or delivered twice,
//                  counts once
//   weighted       the weight and half-life of that type, from settings.ts
//   contributions  what each event adds today, and its rank on its account
//   scored         one row per account: the sum, the three strongest events
//                  with their age, the event count and the newest event
//   final          the stage from the two thresholds, and the domain
//
// `object.account_events` and `object.accounts` are the workspace's native
// models, named `<dataset>.<model>` the way `cargo-ai storage query execute`
// takes them; the extractor rewrites them to the warehouse tables on every
// sync. The age is computed at query time, so a score falls on its own between
// signals: nothing writes it.
export const readinessQuery = `
select
  scored.account_id,
  accounts.domain,
  round(scored.readiness_score, 2) as readiness_score,
  case
    when scored.readiness_score >= ${readyThreshold} then 'ready_now'
    when scored.readiness_score >= ${warmingThreshold} then 'warming'
    else 'cold'
  end as stage,
  scored.top_signals,
  scored.signal_count,
  scored.last_signal_at,
  current_timestamp() as scored_at
from (
  select
    account_id,
    sum(contribution) as readiness_score,
    string_agg(case when strength_rank <= 3 then label end, ', ') as top_signals,
    count(*) as signal_count,
    max(occurred_at) as last_signal_at
  from (
    select
      account_id,
      occurred_at,
      weight * exp(-ln(2) * age_days / half_life_days) as contribution,
      concat(signal_type, ' ', cast(cast(floor(age_days) as int64) as string), 'd ago') as label,
      row_number() over (partition by account_id order by weight * exp(-ln(2) * age_days / half_life_days) desc) as strength_rank
    from (
      select
        account_id,
        occurred_at,
        signal_type,
        age_days,
        ${weightCase} as weight,
        ${halfLifeCase} as half_life_days
      from (
        select distinct
          account_id,
          timestamp_trunc(cast(occurred_at as timestamp), day) as occurred_at,
          coalesce(json_value(properties, '$.signal_type'), model_slug) as signal_type,
          timestamp_diff(current_timestamp(), timestamp_trunc(cast(occurred_at as timestamp), day), hour) / 24 as age_days
        from object.account_events
        where occurred_at is not null
          and cast(occurred_at as timestamp) > timestamp_sub(current_timestamp(), interval ${horizonDays} day)
      ) events
    ) weighted
    where weight > 0
  ) contributions
  group by account_id
) scored
left join object.accounts accounts on accounts.id = scored.account_id
`;

// One row per account with at least one weighed event inside the horizon,
// rebuilt from the query above on every sync. The segments and the play read
// `stage`, never the score itself, so moving a threshold in settings.ts moves
// every account at the next sync with no other edit.
//
// Hourly at :10, after Account Events at :00. A sync replaces the table, so a
// score is as of the last sync; the play's `changeKinds: ["added"]` diffs the
// segment on the account id, so a rebuild does not re-route an account that
// stayed ready.
//
// The deploy cannot see that this model reads `account_events`: the reference
// is inside the query string. That is safe here because Account Events exists
// in every workspace before any deploy. A query over a model this same project
// creates needs that model deployed first.
export const readinessScores = defineModel("readiness_scores", {
  kind: "native",
  extractSlug: "defineQuery",
  description:
    "One row per account with a decaying readiness score from its recent signals, a stage (ready_now, warming, cold) and the signals behind it. Rebuilt hourly from Account Events.",
  folder: modelsFolder,
  config: {
    query: readinessQuery,
    idColumnSlug: "account_id",
    titleColumnSlug: "domain",
  },
  schedule: { type: "cron", cron: "10 * * * *" },
});
