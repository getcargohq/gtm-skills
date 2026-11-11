# The scoring pass

The monthly review keeps `context/` current from the CRM. The scoring pass answers the question the
review cannot: **what separates your best customers from your good ones, in data you can see on any
company before it buys?** It ends in one file, `context/icp/scoring.md`: the Tier 1 definition, every
data point tested with its evidence, and a fit model with a weight and a reason for each attribute,
in the shape [`scoring-format.md`](scoring-format.md) fixes. `account-scoring` applies that model to
the market; this pass only builds it.

It runs in the operator's session, not on the cron, because it asks the team four questions and
spends enrichment credits, and both need a person. Run it once after the monthly agent's first pass
has merged, then again once a year, or sooner when the product or the market changes.

## What it is for

The end goal is a market graded by fit, Strong · Moderate · Weak · No Fit, on evidence rather than
opinion. Two rules follow, and every step below obeys them:

- **Internal data defines what great looks like; it never scores.** Contract value, renewals,
  expansion, NPS, support load and time to value tell you which customers are Tier 1. A company in
  the market has none of that, so none of it becomes a scoring attribute.
- **Every attribute that gets a weight is visible from the outside**: enriched or researched the
  same way for any company.

| Customers today                             | Fit grade in the market |
| ------------------------------------------- | ----------------------- |
| Tier 1 customers (the best of the best)     | Strong                  |
| Tier 2 customers (good, still worth a rep)  | Moderate                |
| What lost deals and churned customers share | Weak                    |
| What the team never targets                 | No Fit                  |

There are three stops where you show your work and wait for the operator: after the audit, after
the Tier 1 definition, and after a 10-account enrichment test.

## Where things go

- `outputs/<today>-win-loss-scoring/README.md`: the run record. Every number in `scoring.md` points
  here. The directory is named `-win-loss-scoring`, never `-win-loss-review`: the monthly agent reads
  the newest `-win-loss-review` directory as the date its next run starts from.
- `outputs/<today>-win-loss-scoring/evidence.csv`: one row per account in the cohort, every value
  with its source and date. No amount, no email, no person.
- `outputs/<today>-win-loss-scoring/scripts/`: every script, numbered in run order. Every number in
  the run record comes from one of them.
- `~/.cache/win-loss-scoring/<today>/`: every raw provider response, outside the repository, so a
  re-run never pays twice and nothing personal is committed.
- `context/icp/scoring.md`: the model, in the shape of `scoring-format.md`.

## Step 1. Audit the data and set the window (stop)

Start from the monthly agent's first-pass record (`outputs/<date>-win-loss-review/README.md`): it
already holds the pipelines, the closed counts and the two hygiene findings. Then find the outcome
data, wherever it lives:

1. `cargo-ai storage model list`, then `cargo-ai storage model get-ddl` on every model that could
   hold an outcome, and `cargo-ai connection connector list` for what is connected (billing,
   warehouse, support, product analytics, NPS). Derive before you ask.
2. Table every outcome field: source, field, what it means, how many accounts have it. Look for the
   first deal's contract value, current revenue, renewals, expansion, churn and its reason, go-live
   date or first production use, support tickets, NPS or CSAT. Ask the operator only for what the
   workspace does not hold, as one question: "Where do renewals, churn, support and NPS live?"
3. Calls: if `cadence/log/raw/calls/` exists (call-capture writes it), it is where the reasons
   buyers gave live. Otherwise note that calls are not available.
4. Count per account, not per deal. The first won deal says when an account was won; later deals
   say how it grew.
5. **Set the window.** Read the median sales cycle from the closed deals (created to closed). The
   default window is the last 12 months of closed deals, the monthly agent's `WINDOW_DAYS`. Widen it
   only when sales cycles run past a year. When the deals do not carry a created date, ask the
   operator for the usual sales cycle.
6. Count the accounts in the window: won, lost after a real evaluation (set the minimum stage from
   the pipeline; early disqualifications are reported apart), churned.

**Stop.** Show the audit table, the window and the counts. Wait.

## Step 2. Define Tier 1 (stop)

Write a Tier 1 rule from the outcome fields the audit found usable, with thresholds anyone could
apply. Leave out any field filled for fewer than about 60% of customers, and say so.

- **Contract value alone never decides.** A large account that churned or costs a lot to serve is
  not Tier 1; a mid-size account that renewed, expanded and went live fast can be.
- **Thresholds are relative**, "top third of first contract values in the cohort", so no amount
  reaches the repository.
- Customers too new to show a renewal are judged on what they already show: time to go-live, usage
  growth, early expansion.

Sort every account into Tier 1 · Tier 2 · churned · lost, and show the Tier 1 list by name. Then ask
the operator, in one message:

1. Who are your 10 best customers, and the 5 you should never have signed? Why?
2. Is any Tier 2 customer there because of how it was delivered, not because of who they are?
3. Which companies do you never target, and why?
4. Do you already have assumptions about what predicts a great customer? If yes, list them.

Answer 2 leaves those accounts out of the comparison. Answer 3 becomes No Fit filters. Answer 4 is
tested first. Change the rule, never an individual account, until the Tier 1 list matches what the
team knows, and record every change and why.

## Step 3. Collect the data points to test

Three sources, then the standard set:

1. **The team's assumptions** (answer 4).
2. **The calls**, when the audit found them: for accounts in the window, the trigger, the use case,
   the tool being replaced and the team that would own it. A reason that recurs is a candidate only
   if it can be seen from outside the company.
3. **The research**: run [`custom-attributes.md`](custom-attributes.md) on your own company's
   domain. It returns up to ten attributes specific to what you sell. Some are thoughtful, some are
   not; each one is tested, none is trusted.

**Standard data points**, always tested: employees, industry, business model, headquarters region,
funding stage or public, headcount in the functions that would own your product and their share of
staff, the stack your product sits on or replaces, web traffic band, mobile apps.

Drop any candidate that only exists inside a customer (usage, billing, health). Keep it in the run
record as an explanation.

## Step 4. Enrich every account in the cohort

1. **Identity first.** Every account gets a verified LinkedIn company page and domain; accept a page
   only when its website matches the account's domain, and try name variants (legal name, brand,
   with and without Inc / Ltd / GmbH, plus the city) before "not found". Everything joins on this.
2. **Test on 10 accounts first.** Run the full enrichment on 10 accounts, fetch each action's
   current price (`cargo-ai connection integration get <slug>`), and report the cost per account and
   the estimate for the cohort. **Stop and wait for the operator's go.**
3. **The same data points for every account**, through one-off
   `cargo-ai orchestration action execute` calls; nothing is deployed. The one-off skills
   `find-linkedin-url`, `enrich-company-data` and `extract-sales-navigator-search` carry the calls.
   Every response is cached under `~/.cache/win-loss-scoring/<today>/`.
4. **Judgment attributes are researched blind.** Business model, maturity, use cases: researched per
   account from public pages, with the evidence URL and a confidence level, by a step that is
   never told whether the account is Tier 1. A researcher that knows who won finds reasons they won.
5. Write `evidence.csv`.

## Step 5. Compare

The main comparison is **Tier 1 against Tier 2**: it decides Strong against Moderate. Then
**customers against lost and churned**: it decides what Weak looks like.

Every result names both groups and the sample: "6 of 9 Tier 1 run a dedicated data team; 8 of 31
Tier 2 do". Never "67% against 26%".

A pattern counts when three things hold:

- **the gap is big**, not a few accounts;
- **there is a reason behind it** (a dedicated data team can own the pipeline, so it goes live
  faster);
- **it held in the period before**: the same check on the deals closed in the window of the same
  length just before this one. When that period holds too few deals, say "not checked".

Two safeguards:

- **Nothing that exists because they bought you.** Your own product in their stack, files and
  processes built around it, a team hired to run it: customers have them because they are
  customers.
- **Missing is not "no".** A provider returning nothing is a coverage gap. It is neutral in the
  model and never reported as a finding.

## Step 6. Draft the model

Write `context/icp/scoring.md` in the shape of [`scoring-format.md`](scoring-format.md). Its json
block has two halves, because account-scoring reads it in two steps:

- **Attributes: what to collect.** Every attribute a filter, a weight or a modifier uses, with its
  definition and `get.kind`: `firmographic` (on any company record), `provider` (a data provider
  action, named in `get.how`), or `research` (public pages, read for one label from a fixed list).
  A research attribute is always a list of labels; a count comes from a record or a provider.
- **No Fit filters** from answer 3 and from what the comparison shows.
- **4 to 6 weighted attributes**, weights summing to 100, the highest weight on the strongest
  pattern that held.
- **Modifiers**: small plus or minus points, never enough to rescue a bad fit.
- **Bands**: Strong, Moderate and Weak thresholds, set so most Tier 1 accounts land in Strong, and
  how the cohort lands in each.

If two attributes carry the same signal, keep the stronger one as points. Timing signals (a launch,
a migration, a new leader) are listed in their own section and never scored here.

## Step 7. Record and open the pull request

Write the run record: the audit, the window and why, the Tier 1 rule and the changes after the
team's answers, the cohort counts, every data point tested (standard and custom) with its result,
whether it held in the period before and keep or drop, how the cohort lands in the bands, the
credits spent, and the scripts in run order. Run the repository's context lint and fix what it
reports.

Open one pull request titled `[win-loss-review] scoring model <today>`. The body opens with the
Tier 1 rule in one sentence and the three attributes that matter most, then the confidence and why.
Never merge it.

## Step 8. Hand off to account-scoring

The model is only useful once it grades the market. End by asking: "If `scoring.md` looks right,
the next step is account-scoring: it enriches every company with these attributes and grades it
with this model. Set it up now?" On a yes, once the pull request has merged, install it
(`cargo-ai project add cookbook/account-scoring`) and continue with its procedure in this session.
With no TAM and no CRM company book to grade yet, tam-building comes first.

Every later rebuild of `scoring.md` ends the same way, straight into account-scoring's rescore: the
same attributes regrade the stored values with no enrichment cost; a new attribute is collected
first, for that attribute's source only.

## Never

Never weight an attribute a company in the market cannot show, never let contract value alone make
a Tier 1, never write an amount, an email or a person into the repository, never score a missing
value below neutral, never keep a pattern that exists because the account bought you, never tell
the blind researcher the account's class, never spend beyond the 10-account test without the
operator's go, and never merge the pull request.
