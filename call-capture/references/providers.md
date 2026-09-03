# Supporting a different recorder

Avoma is the one worked implementation. Adding another is not a fork of the collector: it is one
new file satisfying one type, plus a one-line import swap.

```
scripts/call-capture/collect/
  recorder.ts   the contract + everything true whoever records your calls
  avoma.ts      the worked implementation
  calls.ts      the wiring: `await capture(avoma)`
```

To add Gong, write `gong.ts` beside `avoma.ts` and change `calls.ts` to `await capture(gong)`.
Nothing in `recorder.ts` moves.

## The contract

```ts
export type Call = {
  id: string; // the recorder's own id: the only idempotency key here
  startAt: string; // ISO; its date half becomes the filename
  subject: string;
  attendees: { email?: string; name?: string }[];
};

export type Recorder = {
  provider: string;
  listReady(from: string, to: string): Promise<Call[]>;
  transcript(id: string): Promise<string | null>;
  notes(id: string): Promise<string | null>;
};
```

Four things, and the compiler holds you to all of them — a half-written adapter does not typecheck,
and the error names the field you left out. That is the whole reason this is a type and not a
convention.

Two of the four deserve a note.

**`provider` is load-bearing.** It is written into every file's `source:` line **and** compiled into
the regex that reads those lines back for deduplication. One field feeds both, so they cannot drift.
Were they two literals, changing one and not the other would make the collector stop recognising
what it had already captured and re-capture the whole window every morning — producing files, never
erroring, until someone noticed the repository doubling.

**`listReady` owns readiness.** There is no portable spelling of "the transcript is processed":
Avoma has `state` plus `transcript_ready`, Gong has neither. So the filter lives in the adapter, in
the recorder's own vocabulary, and the pipeline just trusts the list.

What the adapter does **not** own: deduplication, account slugging, the internal-domain filter, file
layout, the rolling window, `--dry-run`. Those are the same whoever answers, and they are in
`recorder.ts`. Auth is not shared — Bearer, Basic and a signed GraphQL POST are three different
things — so each adapter builds its own request; only the 429 backoff is shared, through
`fetchJson(url, init)`, which takes the whole request so the scheme stays yours.

## Write the adapter against the live API, not against docs

Run this before you write a line, because a wrong field name produces a clean, empty run every
morning rather than an error:

```sh
curl -s -H "Authorization: Bearer $CALL_RECORDER_API_KEY" \
  "https://api.avoma.com/v1/meetings/?from_date=$(date -u -v-3d +%F)T00:00:00Z&to_date=$(date -u +%F)T23:59:59Z&page_size=5" \
  | head -c 2000
```

Then take one id and check the transcript endpoint the same way. When the adapter compiles, run the
collector with `--dry-run`: it exercises `listReady` and the readiness filter and prints what it
would capture, writing nothing you would have to unpick.

## Avoma (shipped)

| Piece        | Detail                                                                              |
| ------------ | ------------------------------------------------------------------------------------- |
| Auth         | `Authorization: Bearer <key>`                                                       |
| `listReady`  | `GET /v1/meetings/?from_date=<FROM>T00:00:00Z&to_date=<TO>T23:59:59Z&page_size=100` |
| Paging       | follow the `next` link until it is null                                             |
| Readiness    | `state === "completed"` and `transcript_ready \|\| notes_ready`                      |
| `transcript` | `GET /v1/transcriptions/?meeting_uuid=<id>`                                         |
| `notes`      | `GET /v1/notes/?meeting_uuid=<id>` — nested blocks, walked by `blocksToText`        |

Two fields mislead. `transcript_ready` and `notes_ready` are false until processing finishes and
**absent** rather than false on anything not yet held — the whole reason the window overlaps.
`is_internal` cannot be trusted: some workspaces return false on every meeting, including
all-internal ones, which is why the pipeline derives that from attendee domains instead.

## Gong

| Piece        | Detail                                                                           |
| ------------ | ---------------------------------------------------------------------------------- |
| Auth         | `Authorization: Basic <base64(accessKey:secret)>`                                |
| `listReady`  | `POST /v2/calls/extensive` with a `filter` carrying `fromDateTime` / `toDateTime` |
| Paging       | pass the response's `cursor` back in the next request                            |
| Readiness    | no flag; use the presence of a media or transcript record                        |
| `transcript` | `POST /v2/calls/transcript` with the call ids                                    |

Both are POSTs with a JSON body, which `fetchJson(url, init)` already takes — pass `method` and
`body` rather than editing the helper. Gong returns speaker ids, not names; the participant list in
the extensive response is what maps them, so carry those names through on `Call.attendees` and
`transcript` can attribute its lines.

One migration note: `provider` becomes `"gong"`, so existing Avoma captures read as uncaptured. That
is correct — they are a different recorder's ids — but it means a switchover recaptures history
unless the old entries stay out of `cadence/log/`. Decide that on purpose rather than discovering it.

## Fireflies

| Piece        | Detail                                                                              |
| ------------ | ------------------------------------------------------------------------------------- |
| Auth         | `Authorization: Bearer <key>`                                                       |
| `listReady`  | `POST https://api.fireflies.ai/graphql` — one GraphQL query for transcripts by date |
| `transcript` | the same query, selecting `sentences`                                               |

One endpoint, so `listReady` can hold everything and `transcript` becomes a lookup into what it
already fetched: cheaper, and one fewer failure mode. It also means the response carries the whole
window at once, so keep the per-run scribe cap in place or the agent's context window becomes the
real limit.

## The credential

Whatever the recorder, the key arrives the same way and under the same name — the agent's
`repository.env` in `infra/call-capture/agents/call-scribe.ts`:

```ts
repository: {
  rootDirectory: ".",
  env: {
    CALL_RECORDER_API_KEY: secret("CALL_RECORDER_API_KEY"),
    CALL_CAPTURE_INTERNAL_DOMAIN: "example.com",
  },
},
```

The name is deliberately not the vendor's, so a swap changes the value and the adapter file and
nothing else — not this wiring, not the deploy environment. Keep it a `secret()` reference rather
than an `env()` string: `env()` bakes the value into the spec hash and therefore into
`cargo.state.json`.

## Why there is no provider registry

There is no `CALL_RECORDER=gong` switch and no `providers/` directory holding all three, because
shipping implementations Cargo does not run means shipping code that rots — and "supported" starts
implying "tested" when it means "written once from documentation". One implementation in the tree,
one contract the compiler enforces, and the rest of this file. If your adapter is good, the right
home for it is a pull request that **replaces** the Avoma one in a fork, or a note in your own
repo's `## Decisions`.
