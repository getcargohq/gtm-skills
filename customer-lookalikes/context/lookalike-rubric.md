# Lookalike rubric

PLACEHOLDER: an example for a fictional company. Rewrite every section for your own and keep it in
the project's context repo, where the researcher, the qualifier, the contact finder and the opener
writer all read it. Changing what counts as a fit is a commit to this file, not a deploy.

## What we sell

Fabrikam (fabrikam.example) plans delivery routes for regional fleets of 20 to 200 vehicles that
run their own trucks, and hands the dispatcher the day's plan before the trucks leave the yard.

## Markets

Regional distributors, wholesalers and food service suppliers in the United States and Canada that
deliver with their own fleet. The industries a company serves matter more than its own LinkedIn
label.

## Hard rejects

Any one of these ends the evaluation at tier "reject":

- Not an operating business, or a dead or parked website.
- Headquarters outside the United States and Canada.
- Couriers and last-mile networks that subcontract their vehicles.
- Fleets under 15 vehicles, or over 500.
- A current or past customer (the seed model holds them).

## Blocklist

Never return these, whatever the search says: competitors and partners.

- routeplanner.example
- dispatchly.example
- fleet-partners.example

## Account fit, 0 to 100

- 80 to 100: own fleet of 40 to 200 vehicles, two or more depots, regional distribution as the core
  business.
- 60 to 79: own fleet of 20 to 40 vehicles, or one depot with a stated plan to add one.
- 40 to 59: fits the market, but fleet size or ownership could not be sourced.
- Under 40: a stretch on the market or on size.
- Unknown fields score in the 40 to 59 band; never guess a fleet size.

## Tier

- "1": fit 75 or more and a live situation.
- "2": fit 55 or more.
- "3": everything else that is not a reject.

## Situation, 0 to 50

A trigger needs a date and a source URL. Score the strongest one, by recency:

- A new depot, warehouse or region opened or announced: 30, or 20 when older than 90 days.
- Hiring dispatchers, a fleet manager or an operations lead: 25, or 10 when the post is older than
  60 days.
- A new operations, logistics or supply chain leader in the last 120 days: 20.
- A funding round or an acquisition in the last 180 days: 15.
- Nothing dated and sourced: 0, and urgency says "No live trigger found".

## Functions we sell to

Dispatch and route planning, fleet operations, and logistics or supply chain leadership. A function
is missing when nobody holds a title in it. Below a coverage of 0.20 (people AI Ark can see,
divided by employee count), no function may be called missing.

## Persona tiers

- "1": the owner of dispatch or fleet operations, or whoever would hire for it: Head or VP of
  Operations, Director of Logistics, Fleet Manager. At under 50 employees, the founder or CEO.
- "2": their boss: COO, VP Supply Chain, General Manager.
- "3": adjacent: Transportation Manager, Operations Manager at a single depot.
- "review": a plausible title the tiers above do not name.
- "reject": sales, marketing, finance, HR, IT.

## How openers are written

- Two sentences, plain words, no greeting and no sign-off.
- Start from what is happening at their company, then say what it means for the person's job.
- Name the gap as a fact, never as a criticism.
- No compliments, no customer names, no numbers that are not in the inputs, no exclamation marks,
  no em dashes.
