# Post engagement: see who engages with your own LinkedIn posts, ranked

To find the people and accounts paying attention to your posts, keep every reaction and comment and
score them, instead of judging one like at a time. This cookbook syncs everyone who engages with the
profiles you list through Cargo Signals, and deploys a hosted Engagement Board your team opens with
its Cargo login. It never contacts anyone.

```sh
cargo-ai project add cookbook/post-engagement
```

## What it does

- Syncs every reaction and comment on the tracked profiles' posts from the last month, person and
  company resolved, under a daily cap.
- Scores each person in code: comments over reactions, a half-life so the board ranks who is warm
  now, repeat engagement adding up.
- Rolls people up into accounts, and posts by how many ICP people they pulled.
- Shows ICP fit as a badge and a filter, never as a reason to drop a row.

## What's inside

Adds 6 resources.

| File                                  | Resource                                  | Role                                                         |
| ------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| `infra/models/post-engagement.ts`     | `defineModel` ×2 (`listenInfluencerEngagement`) | reactors and commenters on the tracked profiles: what you buy |
| `infra/apps/engagement-board.ts`      | `defineApp`                               | the hosted board                                             |
| `infra/apps/engagement-board/`        | (the app's own package)                   | Vite + React on `@cargo-ai/app-sdk`; settings in `src/config.ts` |
| `infra/connectors/cargo-signals.ts`   | `defineConnector` (`cargoSignals`)        | the engagement source; its slug is the storage dataset       |
| `infra/folders/index.ts`              | `defineFolder` ×2                         | where the models and the app are filed                       |

## Why the score is in the browser

The rows are already in storage and the score is a few lines of arithmetic, so the board computes
it on load rather than writing scores back. That keeps the models the only thing billed, makes a
weight change take effect on the next reload with no backfill, and means the board can never
disagree with the rows it shows.

## Placeholders (edit before deploy)

1. **`trackedProfiles`** in `infra/models/post-engagement.ts`, and the same handles in **`AUTHORS`**
   in `infra/apps/engagement-board/src/config.ts`.
2. **`ICP`** in `config.ts`: titles, employee ranges, excluded industries, and `ownCompany`.
3. **`dailyLeadLimit`** on each model, priced from the live per-row cost.

## What it does not do

It does not message, connect, comment, like or follow; store anything beyond what Cargo Signals
returns; hand the data to anyone outside the workspace; or decide who is worth contacting.
