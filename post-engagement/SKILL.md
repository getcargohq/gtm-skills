---
name: post-engagement
description: 'See who engages with your own LinkedIn posts, ranked: Cargo Signals syncs everyone who reacts to or comments on the founders'' and company voices'' posts, and a hosted Engagement Board your team opens with its Cargo login scores every person and every account, so repeat engagers and accounts with several people paying attention stop hiding behind one-off likes. Triggers: "who engages with our founder''s LinkedIn posts", "dashboard of people who like and comment on our posts", "which accounts are engaging with our content", "score our LinkedIn engagers", "track engagement on our CEO''s posts", "who keeps reacting to our posts". Cargo project, Cargo Signals listenInfluencerEngagement, defineModel, defineApp, Cargo Hosting, storage SQL. Skip when: you want posts by other people about your problem, judged weekly in a Slack digest, which is social-listening; or you want one list of a post''s engagers once, with nothing deployed.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.92 or later (`defineApp` with a folder), Node.js 22.18 or later, a Cargo workspace with Cargo Signals and Cargo Hosting enabled."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/post-engagement
metadata:
  author: getcargo
  source: cookbook
  personas:
    - marketing
    - sales-leadership
  openclaw:
    requires:
      bins:
        - cargo-ai
    install:
      - kind: node
        package: "@cargo-ai/cli@latest"
        bins:
          - cargo-ai
    homepage: https://github.com/getcargohq/gtm-skills
---

# Post engagement

**State: to-be-approved.** Ported from the board Cargo runs on its own founders' posts, which has
been live in Cargo's workspace since 2026-11-06. This generic version has not yet been
deploy-verified in a fresh workspace. Treat `Done when` below as the acceptance test and review
`cargo-ai project plan` before deploying. Make no outcome claim for this skill until it is approved.

## The outcome

The people paying attention to your posts stop being invisible. A per-engager alert judges one like
and forgets it, so someone who comments on six posts looks the same as someone who liked one. This
keeps every engagement and ranks them:

1. **Two models buy the engagement.** Cargo Signals watches the LinkedIn profiles you list and
   syncs everyone who reacted (`post_reactors`) or commented (`post_commenters`) on their posts from
   the last month, with the person and their company resolved. `dailyLeadLimit` caps the spend.
2. **A hosted board scores it, in code.** The Engagement Board reads those rows live each time it
   opens: a comment is worth more than a reaction, points fade with a half-life, and repeat
   engagement adds up. ICP fit is a badge and a filter beside the score, never a reason to drop a
   row.
3. **Three views.** _People_ ranked by score, with every comment they left. _Accounts_ ranked by how
   many of their people engaged. _Posts_ by how many ICP people each one pulled, for whoever writes
   them. Every view filters by window, source and ICP, and exports CSV.

The board signs viewers in with Cargo and queries storage as them: it holds no token and no copy of
the data, and nobody outside the workspace can open it. Nothing reaches the engagers: no message, no
connection request, no comment.

## Example

> Show us everyone who engages with Dana's and Sam's LinkedIn posts, and which companies keep showing up.

Illustrative output, fictional records:

```text
People (ICP only, last 30 days)                       score  ours  comments
Priya Shah      Head of RevOps, Contoso (201-500)       9.4     4         2
Leo Martin      VP Sales, Northwind (51-200)            6.1     3         1
Ana Costa       Founder, Wingtip Toys (11-50)           3.0     1         1

Accounts                         engagers  ICP  score
Contoso                                 3    2   14.2
Northwind                               2    1    7.0

Posts                                    engagers  ICP  repeat
Dana, 2026-10-28 "We stopped routing…"         84   19      11
```

Priya engaged with four of the eight posts; two colleagues at Contoso engaged too. That is the
account a human looks at first, and nothing was sent to anyone.

## Put it in your project

This folder is a **worked example**: real project resources written for some other company. The job
is to end up with the code your company would have written, in your project, and an agent does the
adapting.

**Install the required authoring skill first.** If `cargo-project` is absent, run:

```sh
npx skills add getcargohq/cargo-skills --skill cargo-project
```

Then read `.agents/skills/cargo-project/SKILL.md` directly; no session reload is needed. Complete its
bootstrap and use its authoring, state, plan, and deployment rules throughout. Stop before any
template work if the skill cannot be installed or read.

1. **Install it: the CLI does the copy.** From inside the project (the folder holding `cargo.json`),
   `cargo-ai project add cookbook/post-engagement` writes this example to `infra/post-engagement/`
   and this procedure to `.agents/skills/post-engagement/`. No project yet?
   `cargo-ai project init <dir> --cookbook post-engagement && cd <dir> && npm install` does both;
   this folder never ships a shell. **If you are reading this from the project's `.claude/skills/`,
   the install already happened: start at step 2.**
2. **Reconcile it with what is already declared.** If the project already has a Cargo Signals
   connector, rewire the import to it and drop the copy: two resources with one slug is a collision
   at deploy. Then set `DATASET` in `infra/apps/engagement-board/src/config.ts` to that connector's
   slug. If the project already syncs founder-post engagement into models, point `MODELS` at those
   and drop `infra/models/post-engagement.ts` rather than paying for the same rows twice.
3. **Write the profiles and the ICP.** List the profiles in `trackedProfiles`
   (`infra/models/post-engagement.ts`) and the same handles in `AUTHORS` (`config.ts`). Write `ICP`
   in `config.ts` from the ICP and personas in the workspace context, and `ownCompany` from the
   company's own website and LinkedIn page. Every value to edit carries a `PLACEHOLDER` comment.
4. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted; _What you will be asked_ is the floor, and you derive before you ask. Record
   what you changed and why under a `## Decisions` section in your copy of this file.
5. **Check, then plan.** `node --import tsx evals/contract.mjs` from this skill's folder,
   `npm ci && npx tsc --noEmit && npx vite build` inside `infra/apps/engagement-board/`, then
   `cargo-ai project types && cargo-ai project check && cargo-ai project plan` from the project
   root. Read the live Cargo Signals price (see _What it costs_), say the daily ceiling out loud,
   show the plan, and stop. Deploy on a yes. Never run `cargo-ai project init --force` in a
   non-empty directory.
6. **Verify.** After the first sync, open the board, walk _Done when_ line by line, and name the top
   three people and top three accounts back to the user. A board with warnings at the top is
   incomplete: fix what they name before calling it done.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked.

| Input                                                | Kind    | How it is answered                                                                                                                       | Why it matters                                                                                                    |
| ---------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `trackedProfiles` and `AUTHORS`                      | asked   | The LinkedIn profile URLs of the people who post for the company. Confirm each URL resolves to the right person before keeping it.      | They are what you buy. A wrong URL buys a stranger's engagers.                                                    |
| `ICP` (`config.ts`)                                  | derived | From the ICP and personas in the workspace context. Asked only when the context has none.                                                | It is the badge and the default filter. Too loose and the board is noise; too tight and real buyers are hidden.  |
| `ownCompany` (`config.ts`)                           | derived | The company's website and LinkedIn company page, from the workspace context.                                                             | Miss it and your own colleagues top the board, because they engage with everything.                              |
| `dailyLeadLimit` (`infra/models/post-engagement.ts`) | asked   | Price it from the live per-row cost before picking. Lower it for profiles whose posts routinely draw hundreds of reactions.             | It is the daily spend ceiling per model.                                                                          |
| connector                                            | derived | `cargo-ai connection connector list` shows whether a Cargo Signals connector exists; `default: true` binds to it.                        | Without it the models sync nothing and the board loads empty with no error.                                       |

## What you can change

| Variation        | When it is right                                                                    | How                                                                                                                                                             | What it costs                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `with-adjacent`  | Founders of tools your buyers already evaluate post often, and their engagers are shopping | Two more models on the same helper with those profiles (`post_reactors_adjacent`, `post_commenters_adjacent`), both added to `MODELS`, the authors added to `AUTHORS` with `ours: false`, and `ADJACENT_LABEL` set | A popular founder's post draws far more reactions than yours: set a lower `dailyLeadLimit` on those two. Their engagers count at `adjacentFactor`. |
| `comments-only`  | Reactions are too noisy, or the budget is tight                                     | Drop `post_reactors` from the models and from `MODELS`                                                                                                          | You lose the quiet repeat likers, often the earliest sign an account is warming up.                                                 |
| `scoring`        | Your audience comments rarely, or engagement goes cold faster or slower             | Edit `SCORING` in `config.ts`: the weights, the adjacent factor, the half-life                                                                                  | Nothing billed. The ranking changes for every row at once, so say which accounts moved.                                            |
| `with-alerts`    | Someone wants a ping when a high-fit person engages                                 | A play on the models' new records, gated by the same ICP rule, posting to an internal Slack channel                                                             | The ICP rule now lives in two places: import it or comment both. A DM per engager becomes noise fast; prefer a weekly digest.       |

## What should not change

- **The board holds no token.** (`infra/apps/engagement-board/src/data.ts`) It queries storage as
  the signed-in viewer through `useCargoApi`. Put an API token in the app and it is compiled into a
  public bundle: anyone with the URL reads your engagers.
- **Every model is paged and counted.** (`data.ts`) Storage SQL returns at most 10,000 rows and says
  nothing when it stops. The board counts first, pages to the count, and warns on a short load.
  Remove that and a busy month silently drops the oldest engagers.
- **Each model is queried on its own.** (`data.ts`) In a storage `UNION ALL` only the first leg's
  model reference resolves. One query across all models returns one model's rows and no error.
- **ICP never drops a row.** (`score.ts`) It is a badge and a filter. Gate the load on it and the
  repeat engager whose title changed last week vanishes from history.
- **Scoring stays deterministic.** (`config.ts`, `score.ts`) The same rows always give the same
  ranking, so a person moving up means they engaged again. An LLM in the score makes the board move
  on reload.
- **Nothing reaches the engagers.** No action on any connector is wired. Liking, commenting,
  connecting or messaging from this pipeline is automated outreach to people who only reacted to a
  post. A human reads the board and decides.
- **`path` stays relative.** (`infra/apps/engagement-board.ts`) The deploy hashes the string: an
  absolute path reads as a change on every machine and in CI.

## Done when

- `node --import tsx evals/contract.mjs` passes
- the app typechecks and `vite build` succeeds inside `infra/apps/engagement-board/`
- `cargo-ai project plan` reports the connector, the two models, the app and the two folders
- after the first sync, `SELECT COUNT(*) FROM <DATASET>.post_reactors` returns rows, which proves
  `DATASET` matches the connector slug
- the board opens with a Cargo login and shows no warning at the top: every model loaded to its
  count, and no row engages with a profile missing from `AUTHORS`
- nobody from your own company is in the top ten people with the ICP filter on
- the top three people and accounts were named back to the user, each person's comments readable in
  their detail sheet
- the run transcript shows no connector action other than the models' sync

## What it costs

Read the live price immediately before the plan, and say it out loud:

- `cargo-ai connection integration get cargoSignals`: the `listenInfluencerEngagement` extractor,
  billed per row returned. The daily ceiling per model is `dailyLeadLimit` times that price.

The board itself costs hosting only: it runs storage queries as the viewer when it opens and caches
the result for five minutes. The bill is the sync, and it is driven by how much engagement the
tracked posts get, not by how often anyone looks. Read the models' row counts after the first week
before raising `dailyLeadLimit`.

## Composes into

`account-scoring` (join the board's accounts against your tiers to see which A accounts are already
warm), `research-account` and `find-stakeholders` when a human decides an engaging account is worth
a closer look, and `social-listening` for the other half: conversations about your problem on posts
that are not yours.
