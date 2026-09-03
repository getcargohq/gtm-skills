/**
 * Collect call recordings into the cadence layer.
 *
 * The deterministic half of call capture: it pulls every call held in a
 * rolling window whose transcript the recorder has finished processing, and
 * writes one raw file per call under `cadence/log/raw/calls/`. It makes no
 * judgements — no summary, no intel, no context. That is the scribe agent's
 * job, and keeping the two apart is the point: a fetch loop an LLM re-derives
 * every morning is a fetch loop that silently changes shape.
 *
 * Run from the repo root:
 *
 *   CALL_RECORDER_API_KEY=… npx tsx scripts/call-capture/collect/calls.ts
 *   CALL_RECORDER_API_KEY=… npx tsx scripts/call-capture/collect/calls.ts --dry-run
 *
 * Idempotent. A call already present anywhere under `cadence/log/` — raw or
 * long since scribed — is skipped, so re-running costs nothing and the
 * overlapping window is free.
 *
 * This file is the wiring and nothing else. `recorder.ts` holds the contract
 * and everything that is true whoever records your calls; `avoma.ts` is the
 * one implementation. To use a different recorder, write an adapter beside
 * `avoma.ts` and swap the import here — see `references/providers.md`.
 */
import { avoma } from "./avoma";
import { capture } from "./recorder";

await capture(avoma);
