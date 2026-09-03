---
name: call-capture
description: 'Every call the team records is collected into the cadence layer each morning, scribed into a log entry, and — once a claim repeats — promoted into the context knowledge layer, as one reviewable pull request against your GTM repo. Triggers: "our call recordings never make it into the knowledge base", "turn our call transcripts into context", "keep our context updated from sales calls", "we relearn the same objection every quarter", "scribe yesterday''s calls into the repo every morning", "replace the GitHub Action that summarizes our meetings". Cargo CDK, defineAgent, harnessSlug claudeCode, repository env, GitHub, Avoma, Gong, Fireflies, cadence, context. Skip when: you want one call summarized right now, which is a read against the recorder''s own API and needs nothing deployed.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.67 or later — 1.0.66 brought `harness` and the harness repository spec, 1.0.67 roots the agent at the package.json that declares the CDK rather than at `infra/`. On 1.0.66, declare `rootDirectory: \".\"` yourself. Also needs a Cargo workspace, a GTM repository with `context/` and `cadence/` at its root (the shape `cargo-ai cdk init` scaffolds), and an API key for whatever records your calls."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/call-capture
metadata:
  author: getcargo
  source: cookbook
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

# Call capture

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

What your team learns on calls stops living in a recording nobody reopens. Every morning one agent
runs, and three things land in your repository:

1. **The raw capture.** A committed script pulls every call the recorder has finished processing and
   writes one file per call into `cadence/log/raw/calls/`. That is the permanent archive, and it is
   never edited or deleted.
2. **The log entry.** The agent reads each raw capture and writes
   `cadence/log/calls/<date>-<account>.md`: what was said, the intel under fixed headings, the
   actions as checkboxes.
3. **The context update.** Where a claim has been heard twice — an objection, a competitor, a
   signal — the agent promotes it into `context/` at the repository root, citing both calls.

Then it opens one pull request and stops. A human merges, and the next `cargo-ai cdk deploy` syncs
`context/` into the workspace context repository, which is where every other Cargo agent reads
before it acts. A correction made once on a call propagates to everything that reasons about your
market, through code review rather than through someone remembering to update a doc.

This is a scheduled CI workflow plus a hosted agent, collapsed into one declared resource. The
schedule, the credentials and the repository binding live in
`infra/call-capture/agents/call-scribe.ts`, and the instructions beside it in
`call-scribe.prompt.ts`, in the same project as everything else the workspace runs. `harnessSlug: "claudeCode"` is what buys the working tree: the output of a call is a diff
across a dozen markdown files, and only an agent with a checkout can produce one.

Three properties make it safe enough to run unattended:

- **The collection is deterministic.** The agent does not fetch calls. `scripts/collect/calls.ts`
  does, the same way every morning, and the agent is told not to improvise that step.
- **The pull request is the gate.** The agent has repository write access and no other write path.
  It cannot email anyone, cannot touch the CRM, and cannot merge itself.
- **The repetition bar.** A claim reaches `context/` only on its second independent occurrence. One
  prospect's offhand remark stays in that call's log entry, where it is evidence; it does not become
  something the whole company believes.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it — the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/call-capture` writes this example to `infra/call-capture/` (resources
   **and** `scripts/`) and this procedure to `.claude/skills/call-capture/`. No project yet?
   `cargo-ai cdk init <dir> --cookbook call-capture && cd <dir> && npm install` does both; this
   folder never ships a shell. **If you are reading this from the project's `.claude/skills/`, the
   install already happened — start at step 2.** On a CLI too old to have `add`, copy this folder in
   as a sibling of what is there by hand; everything below is unchanged.
2. **Reconcile it with what is already declared.** If the project already has a GitHub connector or
   an agents folder, rewire the imports to the existing one and drop the copy; two resources with
   one slug is a collision at deploy. The knowledge layer needs no work: the scaffold already
   declares the repo's root `context/` in `infra/context.ts`, and `defineContext` is a per-workspace
   singleton, which is why this folder ships none. Append this folder's env needs to the project's
   `.env.example`; never overwrite it.
3. **Point the collector at your recorder.** Avoma is what ships, in
   `scripts/collect/avoma.ts`. **On any other recorder, this step is a new file, not an edit.**
   Write `scripts/collect/<recorder>.ts` exporting one object that satisfies the `Recorder` type in
   `scripts/collect/recorder.ts` — a `provider` slug plus `listReady(from, to)`, `transcript(id)`
   and `notes(id)` — then change the single import in `scripts/collect/calls.ts` to pass it to
   `capture`. Nothing else moves: deduplication, account slugging, the internal-domain filter, the
   file format and the rolling window are the same whoever records your calls, and they live in
   `recorder.ts`. `references/providers.md` (installed beside this file) carries the contract in
   full, the endpoints for Gong and Fireflies, and the one migration trap — changing `provider`
   makes existing captures read as uncaptured. Verify the transcript response shape against the
   live API before you deploy: the endpoints are stable, the field names around them have moved,
   and a wrong one captures nothing while reporting a clean run. Then set
   `CALL_CAPTURE_INTERNAL_DOMAIN` to your own email domain, or every internal call is captured as a
   customer one.
4. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted (nobody asks for a variant they do not know exists); _What you will be asked_ is
   the floor, and you derive before you ask. If you are asking more than about four questions you
   have skipped lookups. Record what you changed and why under a `## Decisions` section in your copy
   of this file.
5. **Run the collector by hand once, then plan.** `CALL_RECORDER_API_KEY=… npx tsx
   scripts/call-capture/collect/calls.ts --dry-run` first: it exercises the list call and the
   readiness filter and prints what it would take, writing nothing. Then drop `--dry-run`. If it does
   not produce raw files locally it will not produce them on a schedule, and that is far cheaper to
   find out now. Then
   `npm run check && cargo-ai cdk plan`, show the diff, and deploy only on an explicit yes:
   `cargo-ai cdk deploy`. Never `cdk init --force` into a non-empty directory.
6. **Verify.** Walk _Done when_ line by line and report each with evidence. Deployed cleanly and
   produced nothing is the normal failure — and the second normal failure is a pull request nobody
   can review, so read the first line before you call this done.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked. Only the ones marked
_asked_ genuinely live in the operator's head.

| Input                                                        | Kind   | How it is answered                                                                                                                                                                                                                                     | Why it matters                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| repository binding (`infra/agents/call-scribe.ts`)           | value  | **derived**: leave `repository`, `defaultBranch` and `connector` unset and `plan` fills them from the git origin of the checkout, taking the GitHub connector from the project's own. `cargo-ai cdk check` prints what it resolved: confirm the line reads your repo and `./`.                | This is the working tree the harness clones and the only place its output can land. An `owner/name` written by hand is the one value nobody notices is wrong until a pull request opens against a stranger's repository.                                                |
| `CALL_RECORDER_API_KEY`                                              | env    | **asked**: the recorder's API key, exported before deploy and never committed. It is declared as a `secret()` in the agent's `repository.env`, so it reaches the collector as an environment variable and nothing else.                                  | It is the collector's only credential. Deploy without it set and `secret()` fails loudly at apply, which is the behaviour you want; hard-code it instead and it is in `cargo.state.json` forever.                     |
| `CALL_CAPTURE_INTERNAL_DOMAIN` (`infra/agents/call-scribe.ts`) | value  | **derived**: your own email domain, which the workspace members' addresses already name                                                                                                                                                                | It is how an internal call is told from a customer one. Avoma's `is_internal` is false on every meeting in some workspaces, so it cannot be used; leave the placeholder and every standup is captured as an account.  |
| recorder adapter (`scripts/collect/avoma.ts`)          | value  | **derived**: read which recorder is in the stack from the repo's own context or the workspace connectors. Avoma ships; anything else is one new file satisfying `Recorder` plus an import swap in `calls.ts`, per `references/providers.md`.               | The contract is compiler-enforced, so a half-written adapter fails to build rather than half-working. Pointed at the wrong API it fails on the first request, which is loud; pointed at the right API with a stale field name it captures nothing and reports a clean empty run every morning. |
| GitHub connector (`infra/connectors/git.ts`)                 | value  | **derived**: `cargo-ai connection connector list` shows whether one is authorized; if not, `cargo-ai cdk add connector/github` opens the OAuth consent. The declaration is `adopt: true` because a deploy cannot mint an OAuth grant.                    | It is the agent's entire write path. Without it the run does the work and has nowhere to put it.                                                                                                                      |
| cadence and context paths                                    | value  | **derived**: read `cadence/README.md` and `context/README.md`, and `ls cadence/log/` for what already exists                                                                                                                                            | The agent writes into layers humans already curate. A second parallel folder splits the record in half and the repetition bar stops seeing the earlier occurrence.                                                    |

Checked before moving on, not after the deploy:

- the collector was run by hand once and wrote real raw files
- `cargo-ai cdk check` prints `agent:call-scribe bound to <your repo>#<branch>` with no trailing
  subdirectory — the repo is the one holding `context/` and `cadence/`, and the GitHub grant can
  push to it. A trailing `in infra/` is the failure to catch here: it roots the harness where there
  is no node_modules, so the collector cannot run
- exactly one `defineContext` in the project, resolving to the repo's root `context/`
- `scripts/call-capture/package.json` is present in the project after the install

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something; that is what makes it a variation and not the
default.

| Variation           | When it is right                                                                                          | How                                                                                                                                                                                    | What it costs                                                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notes-not-transcripts` | The repo is growing faster than you want, or your recorder's AI notes are genuinely good                | Reorder the fallback in `collect/calls.ts` so notes are fetched first and the transcript is the fallback                                                                                | You lose the verbatim record, so the scribe can no longer quote and nobody can check a summary against what was actually said. Notes are already an interpretation; scribing them is interpreting an interpretation                 |
| `raise-the-bar`     | Your context is filling with claims that turn out to be one customer's opinion                            | Raise the repetition bar in `infra/agents/call-scribe.prompt.ts` from two independent occurrences to three, and require them to come from different accounts                                               | The knowledge layer lags the field by weeks. A real, fast-moving objection sits unwritten while it is costing you deals                                                                                                            |
| `widen-the-cap`     | The backfill queue is not draining — the pull request reports a remainder that never falls                | Raise the per-run cap in `infra/agents/call-scribe.prompt.ts`, or leave it and let the daily runs grind through the queue                                                                                  | The pull request stops being reviewable, which is the whole control. A diff nobody reads is an auto-merge with extra steps                                                                                                         |
| `internal-calls-too` | You want deal reviews, onboardings and retros in the record as well as customer calls                    | Drop the external-attendee filter in `collect/calls.ts` and file internal captures under their own folder                                                                               | Volume roughly doubles and the signal thins: internal calls restate what customers said, so the repetition bar counts the same occurrence twice and promotes it as if two customers had said it                                     |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **The agent does not fetch calls; the script does.** (`scripts/collect/calls.ts`) A fetch
  loop an agent re-derives every morning is a fetch loop that silently changes shape — a window that
  drifts, a filter that quietly widens, a field read differently on a day the model was less careful.
  The raw archive is the one thing here that has to be byte-identical in its rules every day, because
  everything downstream is diffed against it.
- **`Recorder.provider` stays one field.** (`scripts/collect/recorder.ts`) It is written into
  every `source:` line and compiled into the regex that reads those lines back. Split it into two
  literals and the day they drift, the collector stops recognising what it has already captured and
  re-captures the whole window every morning — producing files, never erroring, until someone notices
  the repository doubling in size.
- **A recorder swap is a new adapter, not an edit to the pipeline.**
  (`scripts/collect/recorder.ts`) Deduplication, slugging, the internal-domain filter, the file
  format and the window are the same whoever records your calls. Move one of them into an adapter to
  make a vendor fit and the next adapter has to reimplement it, which is how two recorders start
  writing subtly different frontmatter and the dedup stops seeing half the archive.
- **`scripts/call-capture/package.json` stays.** (`scripts/package.json`) It is not
  decoration. The CDK loader imports every `.ts` under the project root except directories carrying a
  `package.json`; delete it and `cargo-ai cdk plan` imports the collector and runs it against the live
  API on every plan.
- **The harness root stays the directory holding the `package.json` that declares `@cargo-ai/cdk`.**
  (`infra/agents/call-scribe.ts`) That is where `node_modules` is, so it is the only place
  `npx tsx …/collect/calls.ts` resolves — and in the scaffolded layout it is the repository root,
  which is also where `cadence/` and `context/` live. The binder infers it, so nothing declares it
  here; what must not change is the outcome. **Check it, do not assume it:** `cargo-ai cdk check`
  prints the resolved binding, and a line ending `in infra/` means the harness was rooted where
  there is no package.json and no node_modules. The collector then cannot run at all, and the
  morning reports clean and empty. On a CLI old enough to resolve it that way, pin
  `rootDirectory: "."` in the repository block until you upgrade.
- **The agent opens a pull request and never merges it.** (`infra/agents/call-scribe.prompt.ts`) Everything
  downstream reads `context/` as fact. Remove the review gate and a hallucinated objection, a misheard
  number, or a vendor call misread as pipeline becomes what your scorer, your researcher and your SDR
  all believe — and nothing will ever contradict it, because they read the same file.
- **One entry per call, keyed on the provider uuid, and raw captures are never touched.**
  (`infra/agents/call-scribe.prompt.ts`) The uuid in each file's `source:` line is the only idempotency key
  in this system. Let the agent rewrite entries "to improve them" and the run stops being idempotent:
  a re-run re-litigates history, the diff is unreviewable, and the earlier occurrence the repetition
  bar counted changes underneath it.
- **A claim reaches `context/` only on its second independent occurrence.**
  (`infra/agents/call-scribe.prompt.ts`) Drop the bar and the knowledge layer fills with singletons at the
  same confidence as durable truths. The failure is not noise, it is that nobody can tell which is
  which any more, and the layer stops being trusted at exactly the moment it is big enough to matter.
- **The collector's window overlaps the previous run.** (`scripts/collect/calls.ts`)
  Transcripts are not ready when a call ends. A one-day window silently drops every call the recorder
  was still processing at the cron minute, and because the window only moves forward, those calls are
  never seen again. The overlap is free: uuids already on disk are skipped before any transcript is
  fetched.

## Done when

- `--dry-run` listed the calls it would take, and the run without it wrote those files into
  `cadence/log/raw/calls/` with a `source:` id in each; running it twice wrote nothing the second time
- on a recorder other than Avoma: the new adapter compiles (a half-written one does not typecheck,
  and the error names the missing field), `--dry-run` lists real calls through it, and nothing in
  `scripts/collect/recorder.ts` had to change to make it fit
- `cargo-ai cdk plan` reports three resources and does **not** hit the recorder's API while planning
- the first scheduled run opened one pull request whose body reports four numbers: captured, scribed
  fresh, scribed from backfill, and pending remaining
- every scribed call has exactly one entry under `cadence/log/calls/`, and no raw file was edited,
  moved or deleted
- at least one `context/` file in the diff cites two different calls as its occurrences, and no file
  in the diff cites only one
- a call where your company was the buyer, not the seller, is filed as vendor intel and appears
  nowhere as pipeline
- after merging and `cargo-ai cdk deploy`, the changed `context/` file is readable from the workspace
  context repository, and an agent with the `context` capability quotes it back

## What it costs

There are no connector actions in this skill, so it consumes no per-record credits: the collector
talks to your recorder directly from the harness environment, under whatever API limits your
recording plan already gives you.

The recurring cost is the harness run itself, once a day, and it scales with how much the agent
reads — which is the raw captures it scribes. **The per-run cap is the cost control as well as the
review control.** A lower cap spreads the same backlog over more days at the same daily cost rather
than paying for it all at once, and the pending remainder in the pull request body is how you watch
whether it is keeping up.

## Composes into

`account-scoring` and any agent with the `context` capability (they read the ICP and objection files
this keeps current), `crm-enrichment` (the account files this writes name the record the enrichment
fills), `monitor-buying-signals` (the signals this promotes are what a feed then watches for).
