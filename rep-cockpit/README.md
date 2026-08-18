# Rep cockpit

One screen per rep: their routed, scored accounts with the AI outreach draft
and a "next action" box that writes straight back to the workspace. This is
the surface on top of everything the other skills computed.

## What it does

- Lists the rep's book — tier-A accounts sorted by score — from the base
  `accounts` model.
- Shows what the other skills produced per account: `cargo_score`
  (account-scoring), `territory` (routing-engine), `outreach_draft` (ai-sdr).
- Lets the rep type a next action; it saves onto the account record on blur.
- Ships as a hosted Cargo app (Vite, `*.cargo.app`) — the reconciler uploads
  the bundle, the backend builds and promotes it.

## How it works

```
account-scoring ─ cargo_score ──┐
routing-engine ─ territory ─────┼─▶ accounts (model, in this folder)
ai-sdr ─ outreach_draft ────────┘        │ storage.query / record.update
                                         ▼
rep-cockpit (defineApp) ──────▶ hosted Vite app (*.cargo.app)
   env: VITE_ACCOUNTS_MODEL_UUID = accounts.uuid (deploy-time token)
```

Adds 1 resource on top of the base: the app. The model uuid reaches the
browser via `defineApp`'s `env` — a deploy-time token, so no hardcoded ids.

| File              | Resource    | Role                                |
| ----------------- | ----------- | ----------------------------------- |
| `apps/cockpit.ts` | `defineApp` | the app slot + bundle upload + env  |
| `apps/cockpit/`   | Vite app    | the cockpit UI (app-sdk components) |

## Placeholders (edit before deploy)

1. **Book query** — `apps/cockpit/src/App.tsx` `BOOK_QUERY`: table/column
   names, the tier threshold, and the per-rep filter (territory or owner).
2. **Columns** — `cargo_score`, `territory`, `outreach_draft`, `next_action`
   come from the other skills; deploy those first (or trim the query).

## Done when

Open the app URL (on `repCockpit.url` after deploy): your tier-A accounts
render with score, territory, and the outreach draft; typing a next action and
tabbing away persists it — reload and it's still there.

## Composes from

`account-scoring` (score), `routing-engine` (territory), `ai-sdr` (draft) —
the cockpit is deliberately read-mostly glue over their outputs.
