# Pipeline health analyzer

An agent that reads your open deals and surfaces the at-risk ones, each with the
fix attached.

## What it does

- Evaluates every open deal against five risk rules, weekly.
- Posts one ranked Slack digest: the deals at risk, the amount at stake, and for
  each one the rule that fired and the action that fixes it.
- Writes the risk reason back onto the deal, so next week's digest is auditable
  against last week's.
- Computes your real stage cycle times from your own closed deals, rather than
  assuming a benchmark.

## The design rule

**Every flag names a rule and an action.** A digest that says "this deal looks
risky" gets ignored by week three. A digest that says "no activity in 21 days and
no next step: run a triple-touch, revisit the pains from the last call" gets
worked. That is the difference between a report and a tool.

## v1 rules (CRM data only, shipped)

1. **Stalled.** No activity for 14+ days and no next step scheduled. → Triple-touch
   follow-up, triangulate into the account, revisit unfulfilled pains and promised
   materials.
2. **Single-threaded.** A late-stage deal with no economic buyer or finance
   stakeholder engaged. → Name and find the missing stakeholders. A late-stage
   deal with one contact is one job change from dead.
3. **Stage overrun.** In-stage longer than the average cycle time for that stage,
   computed from your historical closed deals. → Champion enablement, get an
   executive sponsor.
4. **Unqualified.** Marked qualified, but budget or timeline is empty. → Call the
   champion and get the information. Do not guess it.
5. **ICP misalignment.** Off-profile on size, industry, or use case. Reuses the
   score and tier from `account-scoring` if you have it, rather than re-deriving
   fit. → Probe fit early, before more time is spent.

## v2 rules (need external signals, deliberately NOT shipped)

These need a news/signal source and call transcripts. They are listed so the gap
is explicit rather than silently missing:

- **Negative company news** (layoffs, M&A, funding freeze) → probe budget
  sensitivity. Pairs with `signal-based-tam`.
- **Competitor actively in the evaluation** → competitive play, champion
  enablement.
- **Product-fit gaps raised by the prospect** (source: call notes) → address the
  materials and the gaps explicitly.

## What's inside

Adds 3 resources on top of the base.

| File                        | Resource        | Role                                                         |
| --------------------------- | --------------- | ------------------------------------------------------------ |
| `models/deals.ts`           | `defineModel`   | the pipeline (native `defineDeal`: no CRM credential needed) |
| `segments/at-risk-deals.ts` | `defineSegment` | the standing view of what the analyst flagged                |
| `agents/analyst.ts`         | `defineAgent`   | evaluates the rules, writes back, posts the digest           |

The segment is a view of the agent's **output**, not a restatement of its input.
The Slack digest is a moment in time and nobody can find it by Wednesday; the
segment is the thing a manager opens on Thursday.

## Placeholders (edit before deploy)

1. **Slack channel** in `agents/analyst.ts`: where the digest lands. The agent
   uses the shared Slack connector; tell it the channel in the prompt or wire a
   channel id when you post.
2. **Language model** in `agents/analyst.ts` `languageModel`: any
   reasoning-grade model.
3. **Cron** in `agents/analyst.ts` `triggers`: defaults to Monday 08:00. Put it
   before your pipeline review, not after.
4. **Stage mapping.** The rules talk about "late stage" and "qualified". Those
   map to your `stage_name` values: state them in the system prompt so the agent
   is not guessing your funnel.
5. **Activity threshold** (14 days) and **which roles count as an economic
   buyer**: both are in the prompt. Change them to match how you actually sell.
6. **The deals source.** The model is native by default. To mirror your CRM's
   deals, install `crm-sync` and swap it for a connector-backed model: the exact
   shape is in the comment at the top of `models/deals.ts`.

## Done when

On a test pipeline, the deals you know are at risk are flagged with the correct
rule and a concrete action, a stale deal is never reported as healthy, and
re-running the agent updates the risk reason on the deal rather than duplicating
the digest.

## Composes into

`account-scoring` (rule 5 reuses its score and tier), `closed-won-multiplier`
(which reads the same deals model to find your wins), and `signal-based-tam`
(which is what would feed the v2 news rules).
