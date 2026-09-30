# Persona pulls

How the personas get their job postings, what it costs, and when to keep a model running.

## The pull

`scripts/collect/personas.ts` lists one `PersonaPull` per persona: exact titles, exact-word
exclusions, the ICP size band, a limit. `scripts/collect/jobs.ts` runs each through TheirStack's
`searchJobs` action and writes `cadence/log/raw/jobs/<slug>.json` with every posting, description
included, and `company_object` (employee count, size range, funding stage, industry) on every row.

Two rules the pull never breaks:

- **Size is filtered at pull time.** `companyFields.min_employee_count` and `max_employee_count`
  are the ICP band. Billing is per returned posting, so a row outside the band is a row you paid
  for and will throw away. The collector still reports how many rows landed inside the band, as a
  check on the provider, never as a filter.
- **`direct_employer` only.** A staffing agency's posting describes a client's job in the agency's
  words, and the persona work reads words.

## The budget, as coded

`scripts/collect/budget.ts` is the rule; the collector reads its three inputs live and never asks:

| Input          | Read from                                                                                | Meaning                                                                |
| -------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `balance`      | `cargo-ai billing subscription get`: subscription credits plus purchased credits         | What the workspace can still spend                                     |
| `unitPrice`    | `cargo-ai connection integration get theirStack`: the per-item cost on `searchJobs`, else on the `fetchJobs` extractor | Credits per returned posting, as published today       |
| `billsCredits` | `cargo-ai connection connector list`: `useCredits` on the bound TheirStack connector     | Own key means TheirStack's plan is billed, not Cargo credits            |

The arithmetic: a connection with its own key pulls the target per persona (40) and may extend to
80 for a persona that has not saturated. Otherwise half the balance is kept back for the rest of
the seeding run, the other half is divided by the number of personas at the unit price, and each
persona gets the target or its equal share, whichever is smaller. Under 15 rows a pull cannot
reach saturation and buys nothing a careers page did not already say, so it is skipped and the
personas stay inferred. The second batch to 80 is offered only when the share could fund it for
every persona: headroom belongs to the workspace, not to one persona.

`--limit=<n>` overrides the budgeted limit and refuses to exceed what the rule allows unless
`--over-budget` is passed too. The agent is told never to pass it; that word is the operator's.

## Reading to saturation

The agent reads a file in batches of 15 to 20 postings, segmented by the company size on each row,
and after each batch writes one line: what changed in its understanding of the job. Two consecutive
batches that change nothing end the read. That is why 40 is the target and not 400: on most
personas saturation arrives between 30 and 50 postings, and a persona that has not saturated at
40 is the case the second batch exists for.

## A standing model

`infra/models/persona-jobs.ts` builds a `defineModel` per persona from the same `PersonaPull`
shape, on the `fetchJobs` extractor. None is deployed by default, because a model runs at creation
and bills `limit` postings before anyone has confirmed the persona. After the seeding run, for a
persona worth watching, copy its entry from `personas.ts` byte for byte into a `personaJobsModel(...)`
call, add the models folder beside it, and deploy. `fetchJobs` is incremental: a scheduled model
only bills postings it has not seen, and the monthly refresh can then read what is new.

A model created some other way (by hand, by a script) is not adopted by a later declaration with
the same slug: the deploy stops on `duplicateSlug` and the way out is
`cargo-ai cdk import model:<slug> <uuid>`. Declare first, then deploy.
