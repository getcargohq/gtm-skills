# Closed-won multiplier

Turn every won deal into net-new lookalike accounts.

## What it does

- Fires when a deal is won. The moment you learn what a good customer looks like
  is the moment to go find more of them.
- Profiles the won account, sources companies that look like it, and writes the
  genuinely net-new ones into your account universe.
- Dedupes every candidate against everything you already have, before creating
  anything.
- Tags each sourced account with the win it mirrors, so a rep can always answer
  "why is this account in my list?".

## How it works

1. **A deal is won.** The play fires on the deal, not on a schedule.
2. **Find the won account** and its LinkedIn page.
3. **Source lookalikes** with `linkedin.extractSimilarCompanies`. Credits-based,
   no API key.
4. **Resolve each candidate** through Cargo's business database: match on name,
   pull firmographics, get a real domain. A candidate without a domain is dropped,
   because an account you cannot dedupe will fork into duplicates.
5. **Dedupe.** Anything already in `accounts` is skipped, whether it came from
   your CRM, a previous run, or another sourcing cookbook.
6. **Create,** tagged with the won account it mirrors.

## The dedupe is the point

Sourcing lookalikes is easy. Sourcing lookalikes that are **already in your CRM**
is worse than doing nothing: it hands reps a list of accounts their colleagues
are already working, and it teaches them not to trust the next list you give
them. That is why the dedupe happens before the write, not after, and why a
candidate that cannot be resolved to a domain is dropped rather than guessed at.

## What's inside

Adds 2 resources on top of the base, reads the deals model from
`pipeline-health`, and uses the shared LinkedIn connector (the lookalike source,
adopted, no key) from `base-gtm`.

| File                             | Resource        | Role                                                   |
| -------------------------------- | --------------- | ------------------------------------------------------ |
| `segments/sourced-lookalikes.ts` | `defineSegment` | everything this cookbook created, traceable to its win |
| `plays/multiply-wins.ts`         | `definePlay`    | profile, source, resolve, dedupe, create               |

The segment is a view of the **output**. The obvious alternative ("closed-won
deals") would just restate the play's own trigger filter in a second place, where
the two could drift apart. What counts as a win is defined once, in the play's
filter.

The `lookalike_of` column on `accounts` (declared in `base-gtm`) is the
traceability tag.

## Placeholders (edit before deploy)

1. **What counts as a win**, in the `filter` of `plays/multiply-wins.ts`. This is
   the most consequential line in the cookbook: change the seed and you change
   every account it sources. The default is every closed-won deal. Most teams
   should narrow it: a minimum deal amount (a $2k win and a $200k win do not
   describe the same company) and a recency window (a win from three years ago
   describes a market you may no longer sell to).
2. **The volume cap per win**, `CAP_PER_WIN` in `plays/multiply-wins.ts` (default
   25). It is enforced, not just advised: the sourcing loop stops once the cap is
   hit, so the cost per win is bounded no matter how many lookalikes LinkedIn
   returns. Each candidate costs two credited calls (match + enrich) whether or
   not it survives the dedupe, so this is a cost control as much as a quality one.
3. **Owner assignment** for created records: pair with `routing-engine` if you
   want them routed on arrival rather than landing unowned.

## Upgrade path

`linkedin.extractSimilarCompanies` is the zero-key default. For ranked lookalikes
with a similarity score, Ocean (`oceanio.searchCompanies` with `lookalikeDomains`)
is the better tool at volume. It needs an API key.

## Done when

Net-new accounts land in the account universe, **none of them pre-existing**, and
each one is traceable through `lookalike_of` to the won account that generated
it.

## Composes into

`contact-sourcing` (find the buyers at every account this created),
`account-scoring`, `routing-engine`, and `pipeline-health` (which owns the deals
model this reads).
