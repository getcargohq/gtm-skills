# Choosing a recorder, and adding one

Nine recorders ship. Picking one is a value in the agent's env; a tenth is one new file and one
entry in a registry. Neither is a fork of the collector.

```
scripts/call-capture/collect/
  recorder.ts        the contract + everything true whoever records your calls
  calls.ts           the entrypoint: resolve a slug, then capture
  recorders/
    index.ts         the registry: slug -> adapter, and the selection
    fields.ts        reading a field whose name the vendor does not document
    turns.ts         one transcript format, whoever recorded the call
    avoma.ts         verified against a live workspace
    clari.ts  fathom.ts  fireflies.ts  gong.ts
    grain.ts  granola.ts  modjo.ts  tldv.ts
```

## Pick one

```sh
# what ships, and what each wants for a credential
npx tsx scripts/call-capture/collect/calls.ts --list

# one run, without touching the deployed env
CALL_RECORDER_API_KEY=… npx tsx scripts/call-capture/collect/calls.ts --recorder=granola --dry-run
```

| Slug        | Recorder      | Auth                                         | Readiness signal                       |
| ----------- | ------------- | -------------------------------------------- | -------------------------------------- |
| `avoma`     | Avoma         | `Authorization: Bearer`                      | `state` + `transcript_ready`           |
| `clari`     | Clari Copilot | `X-Api-Key` **and** `X-Api-Password`         | `status`, two good values of fourteen  |
| `fathom`    | Fathom        | `X-Api-Key`                                  | none                                   |
| `fireflies` | Fireflies.ai  | `Authorization: Bearer`, GraphQL POST        | `meeting_info.summary_status`          |
| `gong`      | Gong          | `Authorization: Basic base64(key:secret)`    | none                                   |
| `grain`     | Grain         | Bearer **and** a pinned `Public-Api-Version` | none                                   |
| `granola`   | Granola       | `Authorization: Bearer`                      | none                                   |
| `modjo`     | Modjo         | `Authorization: Bearer`                      | `transcriptRetentionStatus`, and a 410 |
| `tldv`      | tl;dv         | `x-api-key`                                  | none, webhook only                     |

The deployed selection is `CALL_RECORDER` in the agent's `repository.env`, beside the credential.
**There is no default.** Unset, the collector stops and prints the table above, because a
valid-but-wrong slug reads the wrong vendor's API perfectly successfully, captures nothing, and
reports a clean empty run every morning — which is the failure this cookbook is built to avoid.

`avoma` is the only entry marked `live`. The other eight were written from each vendor's own
specification and compile; they have not been run against a real workspace, they say so on every
run, and `--dry-run` is how you settle it before deploying. Which is not a reason to distrust them
so much as the reason the flag exists: read the next section before you assume a clean run is a
working one.

## Verify it before you deploy it, whichever you picked

A wrong field name does not error. It produces a clean, empty, entirely successful-looking run,
every morning, until someone wonders why the repository has stopped growing. So:

```sh
# 1. does the credential work and does the list endpoint answer?
npx tsx scripts/call-capture/collect/calls.ts --recorder=<slug> --dry-run
```

That exercises `listReady` and the readiness filter and writes nothing. It should print real
calls, with the dates and account slugs you expect. Then drop `--dry-run` and read one captured
file: if the transcript body is missing while the frontmatter is right, the list endpoint is fine
and the transcript shape has moved.

`references/recorder-apis.md` has the endpoints, the exact field names and the gotchas for all
nine, plus five more that do not ship, each with a curl you can run before you trust anything.

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

**`provider` is load-bearing, and the registry key must equal it.** It is written into every file's
`source:` line **and** compiled into the regex that reads those lines back for deduplication. One
field feeds both, so they cannot drift. File an adapter under a key that disagrees with its own
`provider` and the collector stops recognising what it has already captured and re-captures the
whole window every morning — producing files, never erroring, until someone notices the repository
doubling. `resolve()` refuses that mismatch and `evals/contract.mjs` fails on it, because it is the
one failure here that is both silent and expensive.

**`listReady` owns readiness.** There is no portable spelling of "the transcript is processed":
Avoma has `state` plus `transcript_ready`, Fireflies has a clean enum, Clari has a status with
fourteen values, and Gong, Fathom, Granola, Grain and tl;dv have nothing at all. So the filter
lives in the adapter, in the recorder's own vocabulary, and the pipeline just trusts the list.
Where a recorder signals nothing, the adapter returns the window whole and lets `transcript()`
answer null — the overlapping window is the retry, and that is why it overlaps.

What the adapter does **not** own: deduplication, account slugging, the internal-domain filter,
file layout, the rolling window, `--dry-run`. Those are the same whoever answers, and they are in
`recorder.ts`. Auth is not shared — Bearer, Basic, two custom headers and a signed GraphQL POST are
four different things — so each adapter builds its own request; only the 429 backoff is shared,
through `fetchJson(url, init)`, which takes the whole request so the scheme stays yours.

## Add a recorder that is not here

Six steps, and the first one is not writing code.

1. **Read the vendor's own reference for four things**: how the list endpoint filters by date, how
   it paginates, what the transcript response calls its segments and its speaker, and whether
   anything signals readiness. `references/recorder-apis.md` has these for five recorders that do
   not ship, including the ones deliberately left out and the reason for each.
2. **Copy the closest shipped adapter, not the simplest one.** `avoma.ts` for a plain Bearer REST
   API with next-link paging; `gong.ts` for POST-with-a-body, cursor paging, and a speaker id that
   must be joined against a party list; `fireflies.ts` for GraphQL; `clari.ts` for two custom
   headers and one detail request serving both `transcript` and `notes`; `granola.ts` for a list too
   thin to carry attendees.
3. **Write `recorders/<slug>.ts` exporting one object satisfying `Recorder`.** Read the credential
   through `recorderKey()` (or `recorderKeyPair()` where the vendor issues two values) inside the
   request, never at import: the registry imports every adapter on every run.
4. **Register it** in `recorders/index.ts` with its label, what the credential holds, its docs URL,
   and `written: "docs"`. The slug is the key and the key is `provider`.
5. **Run `--dry-run`,** then a real run, then a second real run — which must write nothing, because
   everything is already captured.
6. **Move it to `written: "live"`** in the same change that reports what the run listed. That field
   is the only thing standing between a registry and an implied promise it has been tested.

Three patterns cut across every recorder and are worth deciding once rather than rediscovering:

**Speaker attribution is usually a join, not a field.** Gong's `speakerId`, Clari's `personId`,
Grain's `participant_id` and Modjo's `speaker.id` all hand back an identifier where you want a
name, and the mapping lives on the call object, not the transcript. So `listReady` keeps what it
learned and `transcript` reads it — a transcript fetched without a prior list is unattributable
text. Avoma, Fathom, Fireflies, Granola and tl;dv give you a name directly.

**Internal versus external stays in the pipeline.** Gong, Fathom, Grain and Modjo each flag it, and
the flags do not agree with each other; Avoma's is false on every meeting in some workspaces. So
every adapter passes attendees through and `recorder.ts` applies one rule —
`CALL_CAPTURE_INTERNAL_DOMAIN` against the email domain — for all of them. An adapter that filtered
attendees itself would make the same call read as internal on one recorder and external on the
next.

**Rendering is shared, not per-vendor.** `turns.ts` takes a flat list of "someone said this" and
renders `**Name:** text`, joining consecutive segments from one speaker. Recorders segment wildly
differently — whole monologues from Gong, sentences from Grain — and unjoined, the same call is 40
lines from one and 400 from another. The agent's per-run cap is spent reading those lines, so this
is a cost difference as much as a legibility one.

## The credential

Whatever the recorder, the key arrives the same way and under the same name — the agent's
`repository.env` in `infra/call-capture/agents/call-scribe.ts`:

```ts
repository: {
  env: {
    CALL_RECORDER: "avoma",
    CALL_RECORDER_API_KEY: secret("CALL_RECORDER_API_KEY"),
    CALL_CAPTURE_INTERNAL_DOMAIN: "example.com",
  },
},
```

The name is deliberately not the vendor's, so a swap changes two values and nothing else — not this
wiring, not the deploy environment. Keep it a `secret()` reference rather than an `env()` string:
`env()` bakes the value into the spec hash and therefore into `cargo.state.json`.

Two recorders issue two values rather than one. Gong wants an access key and a secret, Clari
Copilot a key and a password: set `CALL_RECORDER_API_KEY` to `<first>:<second>` and the adapter
splits it on the first colon. One secret, whatever records your calls.

Gong is also the one recorder whose base URL is per company — regional instances are
`https://<region>.api.gong.io/v2`. Set `CALL_RECORDER_API_BASE` when yours is not the common one.

## Switching recorder is a switch of id space

`provider` prefixes every `source:` line, so captures made under the old recorder read as
uncaptured under the new one. That is correct — they are a different recorder's ids for different
recordings — but it means a switchover re-captures history unless the old entries stay out of
`cadence/log/`. Decide it on purpose rather than discovering it: either accept a one-off re-capture
of the window, or move the old raw files somewhere the dedup does not read before the first run.

## Why the registry stays thin

Nine implementations is nine things that can rot, and "supported" starts implying "tested" when it
means "written once from documentation". Three rules keep that honest, and they are worth holding
even when a tenth recorder would be easy to add:

- **`written` tells the truth.** `live` means someone ran it against a real workspace. Anything else
  is `docs`, it says so on every run, and moving it is a claim someone makes with evidence.
- **An adapter earns its place by being someone's recorder.** The five in
  `references/recorder-apis.md` that do not ship are not missing work; each has a named reason —
  no date filter on the list endpoint, a transcript that is not JSON, an OAuth token that expires
  in ten minutes and cannot survive an unattended cron. Writing them anyway would be shipping code
  nobody runs, which is how a registry becomes a graveyard.
- **Nothing moves into the pipeline to make a vendor fit, and nothing moves out of it to make one
  easier.** If a recorder needs deduplication, slugging, the domain filter, the file format or the
  window changed, that is a conversation about the pipeline, not an adapter detail — because the
  next adapter would have to reimplement whatever moved, and then two recorders write subtly
  different frontmatter and the dedup stops seeing half the archive.
